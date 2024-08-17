<!-- Main file, controlling the interface and calculations. -->

<script setup lang="ts">

    import { TresCanvas } from '@tresjs/core';


    /*
     * Config
     */
    const sundialOrigin = new Vector3(0, -1, 0);
    /** relative to sundial origin and rotation */
    const gnomonRelativePosition = ref<number[]>([0,1,0]);
    /** euler angle */
    let sundialRotation = ref<Euler>(new Euler(0,0,0, "YXZ"));
    let sundialNormal = computed(() => new Vector3(0, 1, 0).applyEuler(sundialRotation.value));


    /*
     * Independent variables
     */
    /** 0 to 24*60 */
    let localTime = ref<number>(12 * 60);
    /** 0 to 364 (integer) */
    let day = ref<number>(100);
    let longitude = ref<number>(0);
    let latitude = ref<number>(0);
    let autoSelectTimeZone = ref(true);
    /** +/- minutes UTC */
    let timeZone = ref<number>(0);
    let numerals = ref<"roman"|"arabic">("arabic");
    let sunRaysPassThroughEarth = ref(false);
    let hourLineStyle = ref<"solar"|"standard">("solar");


    /*
     * Allow the time to be input manually.
     */
    let isEditingTime = ref<boolean>(false);
    /** What's in the time manual entry box */
    let timeEntryValue = ref<string>("");
    const timeEntryBox = ref<HTMLInputElement | null>(null);   
    function showTimeEntryBox() {
        if (isEditingTime.value == false) {
            isEditingTime.value = true;
            timeEntryValue.value = timeToString(localTime.value);

            /** @todo this doesn't work because it is not yet mounted (?) */
            //timeEntryBox.value?.focus();
        }
    }
    function hideTimeEntryBox() {
        if (isEditingTime.value == true) {
            isEditingTime.value = false
            /**@todo parse the time */
        }
    }
    onClickOutside(timeEntryBox, hideTimeEntryBox)


    /*
     * Sidebar form validation 
     */
    const formDefaults = {
        latitude:"52.48",
        longitude:"0.12",
        timeZone:"+0:00"
    }

    /** used to parse time zone user input*/
    const timeZoneRegex = /^\s*([+-±]?)\s*((?:0?[0-9])|1[0-9])(?::((?:0[0-9])|[1-5][0-9]))?\s*$/;

    let formState = reactive(formDefaults);
    const formRules = computed<Record<keyof typeof formDefaults, any>>(() => ({
        latitude: {
            required,
            decimal,
            minValue:minValue(-90),
            maxValue:maxValue(90)
        },
        longitude: {
            required,
            decimal,
            minValue:minValue(-180),
            maxValue:maxValue(180)
        },
        timeZone: {
            isATimeZone: helpers.withMessage("Your time zone should look like +/-HH(:MM)", helpers.regex(timeZoneRegex))
        }
    }))
    const v$ = useVuelidate(formRules, formState)

    // parse and updadte whenever valid entries are changed in the form.
    watch(() => formState.longitude, newVal => {
        if (!v$.value.longitude.$invalid) {
            longitude.value = Number.parseFloat(newVal);
            // set the time zone as well.
            if (autoSelectTimeZone.value) {
                formState.timeZone = timeZoneToString(longitudeToTimeZone(longitude.value));
            }
        }
    }, { immediate: true })
    watch(() => formState.latitude, newVal => {
        if (!v$.value.latitude.$invalid) latitude.value = Number.parseFloat(newVal);
    }, {immediate:true})
    watch(() => formState.timeZone, newVal => {
        const result = newVal.match(timeZoneRegex);
        if (result) {
            const newValInt = (result[1] == "-" ? -1 : 1) * (Number.parseInt(result[2]) * 60 + Number.parseInt(result[3] ?? 0));
            // change the local time so that the global time remains consistent
            localTime.value = (((localTime.value + newValInt - timeZone.value) % 1440) + 1440) % 1440
            timeZone.value = newValInt;
        }
    }, {immediate:true})

    /**
     * Set the latitude and longitude when the user clicks on the map.
     */ 
    let mapImage = ref<HTMLImageElement>();
    let mapImageIsBeingClicked = ref(false);
    function setLatLngFromMap(e:MouseEvent) {
        if (mapImage.value) {
            const longitude = e.offsetX / mapImage.value.width * 360 - 180;
            const latitude = 90 - e.offsetY / mapImage.value.height * 180;
            formState.longitude = longitude.toFixed(1);
            formState.latitude = latitude.toFixed(1);
        }
    }
    function mapImageMouseMove(e:MouseEvent) {
        if (mapImageIsBeingClicked.value) setLatLngFromMap(e)
    }
    function mapImageStartClicking() {
        mapImageIsBeingClicked.value = true;
    }
    function mapImageClick(e:MouseEvent) {
        setLatLngFromMap(e)
    }
    onMounted(() => {
        window.addEventListener("mouseup", () => {
            mapImageIsBeingClicked.value = false;
        })
    })


    // set the time zone as the user clicks the checkbox
    watch(() => autoSelectTimeZone.value, value => {
        if (value) {
            formState.timeZone = timeZoneToString(longitudeToTimeZone(longitude.value));
        }
    })

    /**
     * computed values
     */
    /** convert local time to UTC +0 */
    let time = computed(() => (((localTime.value - timeZone.value) % 1440) + 1440) % 1440)
    let sunHorizontalCoords = computed(() => calculateSunHorizontalCoords(day.value, time.value, latitude.value, longitude.value));
    let sunCoords = computed(() => horizontalToActualCoords(sunHorizontalCoords.value.azimuth, sunHorizontalCoords.value.altitude))
    // let gnomonRotation = computed(() => (90-latitude.value)*Math.PI/180);
    let isDaytime = computed(() => sunHorizontalCoords.value.altitude >= 0);
    let statusTextColor = computed(() => isDaytime.value ? "black" : "white")
    let timeText = computed(() => timeToString(localTime.value))
    let dateText = computed(() => dateToString(day.value));
    let meanSolarTime = computed(() => time.value + ((longitude.value/360)*24*60));
    let meanSolarTimeText = computed(() => timeToString(meanSolarTime.value));
    let apparentSolarTime = computed(() => {
        // use the already-computed sun position. This isn't actualy dependent on the latitude irl. Just seemed the easiest way to do it here.
        // to calculate this, rotate sun position (90°-latitude) anticlockwise about x axis (west to east axis). Then work out projected angle in the x/z (horizontal) plain.
        const latRad = latitude.value * Math.PI/180;
        const timeHours = Math.atan2(sunCoords.value.y * Math.cos(latRad) + sunCoords.value.z * Math.sin(latRad), sunCoords.value.x) * 12 / Math.PI + 6;
        const timeMins = (((timeHours % 24) + 24) % 24) * 60;
        return timeMins;
    })
    let apparentSolarTimeText = computed(() => timeToString(apparentSolarTime.value))
    let timeZoneText = computed(() => timeZoneToString(timeZone.value))
    let sunlightIntensity = computed(() => {
        // 0.8 term is so that there is still some light when the sun is just below the horizon
        if (sunHorizontalCoords.value.altitude > 0.1) return 1;
        if (sunHorizontalCoords.value.altitude > -0.1) return (sunHorizontalCoords.value.altitude + 0.1)/0.2;
        return 0;
        // let intensity = Math.cos(Math.PI / 2 - sunHorizontalCoords.value.altitude * 0.8);
        // if (intensity < 0) intensity = 0;
        // return intensity;
    })
    let skyColor = computed(() => {
        // raise to a high power so brightness stays the same throughout most of the time the sun is up
        // to simulate eyes adjusting to the changing brightness
        return interpolate(["#02407a", "#87CEEB"])(1-(1 - sunlightIntensity.value));
    })
    let gnomonAbsolutePosition = computed(() => {
        return new Vector3(...gnomonRelativePosition.value)
            .applyEuler(sundialRotation.value)
            .add(new Vector3(...sundialOrigin))
    })
    /** if there is an interection return it, and the direction along the gnomon which intersects.*/
    let _stylePlateIntersection = computed(() => {
        // intersect the plane of the plate with the line of the sundial gnomon.
        const plane = new Plane(sundialNormal.value, 0).translate(new Vector3(...sundialOrigin));
        const rayDir = new Vector3(0, -(Math.sin(latitude.value * Math.PI / 180)), (Math.cos(latitude.value * Math.PI / 180)));
        return infiniteLineIntersectWithPlaneWithDir(plane, gnomonAbsolutePosition.value, rayDir);
    })
    let stylePlateIntersectionPoint = computed(() => _stylePlateIntersection.value?.point ?? null);
    /** If the intersection with the plate lies on the line between the center of the gnomon and celestial north, then this value is -1. If south, then 1.*/
    let stylePlateIntersectionPointOrder = computed(() => _stylePlateIntersection.value?.dir ?? null)
    
    const hourLineHours = [...Array(24).keys()];
    // angle of each line on the sundial that represents one hour.
    let hourLineDirections = computed(() => hourLineHours.map(i => {
        let offsetHour;
        if (hourLineStyle.value == 'standard') {
            // need to adjust for time zones
            offsetHour = i - timeZone.value/60 + longitude.value*24/360
        }
        else {
            offsetHour = i;
        }
        return calculateShadowDirection(
            ((((offsetHour * 60) % 1440) + 1440) % 1440) * Math.PI * 2 / 1440,
            latitude.value * Math.PI / 180,
            new Vector3(...sundialNormal.value)
        ).multiplyScalar((stylePlateIntersectionPointOrder.value ?? 1))
        // the scalar multiple is to fix a bug with the numerals being offset by 12 hours in some cases.
    }));



    // lambdas of the formula plateStyleIntersectionPoint + lambda * shadowDir such that it intersects the edge of the sundial plate.
    let hourLineSundialSphereIntersectionParameters = computed(() => {
        if (stylePlateIntersectionPoint.value) {
            // to get the portion of the line we want, intersect each hour line with a sphere centered on the sundial plate origin.
            return hourLineDirections.value.map((shadowDir, i) => {
                const lambdas = infiniteLineIntersectWithSphereParameters(new Vector3(...sundialOrigin), 5, stylePlateIntersectionPoint.value as Vector3, shadowDir)
                if (lambdas.length == 0) return [];
                // lambda = 0 is the plate/style intersection point. Negative values are on the wrong side.
                if (lambdas[0] < 0 && lambdas[1] < 0) return [];
                // only display positive values
                if (lambdas[0] < 0) lambdas[0] = 0;
                // we know that lambdas[1] > 0.
                return lambdas
            })
        }
        else {
            // special case when style is parallel to the plate, and the style/plate intersection point does not exist
            /** @todo */
            return hourLineDirections.value.map((angle, i) => [])
        }
    })


    let hourLines = computed(() => hourLineHours.map((hour, i) => {
        const shadowDir = hourLineDirections.value[i];
        const lambdas = hourLineSundialSphereIntersectionParameters.value[i];
        return {
            hour: hour,
            label: (() => {
                switch (numerals.value) {
                    case 'arabic': return hour.toString()
                    case 'roman': return ["XXIV", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI", "XXII", "XXIII"].at(hour) ?? "";
                }
            })(),
            points: lambdas.length == 0 ? null : [
                shadowDir.clone().multiplyScalar(lambdas[0]).add(stylePlateIntersectionPoint.value as Vector3),
                shadowDir.clone().multiplyScalar(lambdas[1]).add(stylePlateIntersectionPoint.value as Vector3),
            ],
            labelPoint: (() => {
                // where the label should be displayed.
                if (stylePlateIntersectionPoint.value) {
                    // the sundial radius is 5. Intersect the hour line with a sphere of radius 4, centered on the sundial origin
                    const labelSphereIntersectLambdas = infiniteLineIntersectWithSphereParameters(new Vector3(...sundialOrigin), 4, stylePlateIntersectionPoint.value as Vector3, shadowDir);
                    if (labelSphereIntersectLambdas.length == 0) return null;
                    if (labelSphereIntersectLambdas[1] < 0) return null;
                    const point = shadowDir.clone().multiplyScalar(labelSphereIntersectLambdas[1]).add(stylePlateIntersectionPoint.value as Vector3);
                    // prevent numbers from getting too bunched up
                    if (stylePlateIntersectionPoint.value?.distanceTo(point) < 3) return null;
                    // move to relative coordinate of sundial
                    point.sub(sundialOrigin).applyMatrix4(new Matrix4().makeRotationFromEuler(sundialRotation.value).invert())
                    return point.toArray();
                } else {
                    /** @todo */
                    return null;
                }
            })()
        }
    }));
   

</script>

<template>
    <TresCanvas :clear-color="skyColor" shadows :shadowMapType="BasicShadowMap" window-size>
        <TresPerspectiveCamera />
        <SundialObject :latitude="latitude" :origin="sundialOrigin" :rotation="sundialRotation"
            :gnomon-position="gnomonRelativePosition" :hour-labels="hourLines" />
        <SunObject :position="[sunCoords.x, sunCoords.y, sunCoords.z]" />
        <template v-for="hourLine in hourLines" v-bind:key="hourLine.hour">
            <Line2 :points="hourLine.points ?? [[0,0,0], [0,0,0]]" :line-width="0.002" />
        </template>

        <!-- directional light points at :target="[0,0,0]" by default -->
        <TresDirectionalLight :position="[sunCoords.x, sunCoords.y, sunCoords.z]"
            :intensity="sunRaysPassThroughEarth ? 1 : sunlightIntensity" :shadow-mapSize-width="2048"
            :shadow-mapSize-height="2048" cast-shadow />
        <TresAmbientLight color="#AAAAAA" />
        <OrbitControls :enable-damping="false" :rotate-speed="0.5" :enable-pan="false" :target="[0,0,0]" />
        <TresGridHelper :args="[50, 50, '#AAAAAA', '#AAAAAA']" :position="[0, -8, 0]" />
    </TresCanvas>


    <div class="sidebar">

        <!-- Position -->
        <h2>Coordinates</h2>
        <div class="horizontal_settings">
            <div class="setting">
                <label>Latitude</label>
                <input class="small_input" v-model="v$.latitude.$model">
                <div class="error" v-if="v$.latitude.$dirty && v$.latitude.$invalid">{{
                    v$.latitude.$errors[0].$message}}</div>
            </div>
            <div class="setting">
                <label>Longitude</label>
                <input class="small_input" v-model="v$.longitude.$model">
                <div class="error" v-if="v$.longitude.$dirty &&v$.longitude.$invalid">{{
                    v$.longitude.$errors[0].$message}}</div>
            </div>
            <div class="setting">
                <label>Time Zone</label>
                <input class="small_input" v-model="v$.timeZone.$model">
                <div class="error" v-if="v$.timeZone.$dirty && v$.timeZone.$invalid">{{
                    v$.timeZone.$errors[0].$message }}</div>
            </div>
        </div>

        <!-- interactive location selector -->
        <div>
            <div style="display: grid; grid-template-columns: min-content auto;">
                <input style="grid-row: 1; grid-column: 1; margin-right:10px" type="range" min="-90" max="90"
                    step="-0.1" class="slider" orient="vertical" v-model="v$.latitude.$model">
                <!-- <div id="coordBox" style="grid-row: 1; grid-column: 2;"></div> -->
                <div style="position:relative">
                    <img src="./assets/world-map-coordinates-correct.png" id="mapImage"
                        alt="An outline world map, on which the user can click to set the latitude and longitude."
                        style="grid-row: 1; grid-column: 2; aspect-ratio: 2 / 1" draggable="false"
                        @mousemove="mapImageMouseMove" @mousedown="mapImageStartClicking" @click="mapImageClick"
                        ref="mapImage">
                    <div id="markerPoint"
                        :style="`top:${(90 - latitude) * 100 / 180}%; left:${(longitude+180) * 100 / 360}%`"></div>
                </div>

                <input style="grid-row: 2; grid-column: 2; margin-top:4px" type="range" min="-180" max="180" step="0.1"
                    class="slider" v-model="v$.longitude.$model">
            </div>
        </div>

        <div class="setting">
            <input type="checkbox" id="autoSelectTimeZone" v-model="autoSelectTimeZone"
                style="margin-right: 10px; display: inline;">
            <label for="autoSelectTimeZone" style="display: inline">Automatically set time zone</label>
        </div>

        <br>
        <h2>Sundial Settings</h2>
        <div class="setting">
            <label>Slant</label>
            <input type="range" :min="0" :max="Math.PI" step="0.01" class="slider" v-model="sundialRotation.x">
        </div>
        <div class="setting">
            <label>Rotation</label>
            <input type="range" :min="-Math.PI" :max="Math.PI" step="0.01" class="slider" v-model="sundialRotation.y">
        </div>
        <div class="setting">
            <label>Hour lines</label>
            <div class="checkboxSetting">
                <input type="radio" id="solarLines" value="solar" v-model="hourLineStyle">
                <label for="solarLines">Solar time</label>
            </div>
            <div class="checkboxSetting">
                <input type="radio" id="standardLines" value="standard" v-model="hourLineStyle">
                <label for="standardLines">Adjusted for time zone</label>
            </div>
        </div>

        <br>
        <div class="setting">
            <label>Numerals</label>
            <div class="checkboxSetting">
                <input type="radio" id="arabic" value="arabic" v-model="numerals">
                <label for="arabic">Western Arabic (0-23)</label>
            </div>
            <div class="checkboxSetting">
                <input type="radio" id="roman" value="roman" v-model="numerals">
                <label for="roman">Roman (I-XXIV)</label>
            </div>
        </div>

        <br>
        <h2>Misc</h2>
        <div class="checkboxSetting">
            <input type="checkbox" id="sunRaysPassThroughEarth" v-model="sunRaysPassThroughEarth">
            <label for="sunRaysPassThroughEarth">Allow sun rays to pass through the Earth</label>
        </div>

        <br>


        <!-- breathing space at the bottom. Css padding leads to an overflow for some reason -->
        <div style="height:100px"></div>
    </div>



    <!-- status overlay -->
    <div class="status">

        <div style="display:flex; flex-direction: row;">
            <div class="time_display" v-show="!isEditingTime" @click="showTimeEntryBox"
                @keydown.space="showTimeEntryBox" tabindex="0">{{ timeText }}</div>
            <input v-show="isEditingTime" ref="timeEntryBox" class="timeEntryBox" @blur="hideTimeEntryBox"
                @keydown.enter="hideTimeEntryBox" v-model="timeEntryValue">
            <div v-show="!isEditingTime"
                style="display: flex; margin-left:10px; justify-content:space-between; flex-direction: column; align-items: stretch; padding-block: 9px">
                <div class="subtitle">{{ isDaytime ? "☀️" : "🌙" }}</div>
                <div class="subtitle">UTC {{ timeZoneText }}</div>
            </div>


        </div>



        <div class="subtitle">{{ meanSolarTimeText }} mean solar time</div>
        <div class="subtitle">{{ apparentSolarTimeText }} apparent solar time</div>

        <input type="range" min="0" max="1440" step="10" class="slider" id="time" v-model.number="localTime">

        <div class="subtitle">{{dateText}}</div>
        <input type="range" min="0" max="364" step="1" class="slider" id="day" v-model.number="day">


    </div>

</template>


<script lang="ts">
    import { Line2, OrbitControls } from '@tresjs/cientos'
    import { onClickOutside } from '@vueuse/core'
    import interpolate from "color-interpolate";
    import { computed, defineComponent, onMounted, reactive, ref, watch } from 'vue'
    import SunObject from './components/SunObject.vue';
    import { decimal, helpers, maxValue, minValue, required } from '@vuelidate/validators';
    import useVuelidate from '@vuelidate/core';
    import { BasicShadowMap, Vector3, Plane, Euler, Matrix4,} from 'three';
    import { dateToString, calculateShadowDirection, horizontalToActualCoords, calculateSunHorizontalCoords, timeToString, timeZoneToString, infiniteLineIntersectWithPlane, infiniteLineIntersectWithSphere, infiniteLineIntersectWithSphereParameters, infiniteLineIntersectWithPlaneWithDir, longitudeToTimeZone } from '@/calculations';
    import SundialObject from './components/SundialObject.vue';
    export default defineComponent({
        name:"App",
        components: {SundialObject, SunObject}
    })
</script>

<style>
    #app {
        font-family: sans-serif;
        color: white;
    }
</style>

<style scoped>
    .sidebar {
        width: 30%;
        max-width: 500px;
        background: rgba(39, 39, 39, 0.95);
        position: absolute;
        left: 0;
        top:0;
        height: 100%;
        /* padding-top: 20px;
        padding-left:20px;
        padding-right: 20px;
        padding-bottom: 100px; */
        padding: 20px;
        overflow-x: scroll;
    }
    .sidebar h2 {
        /* color:white; */
        font-size: 15pt;
        background-color: brown
    }

    .horizontal_settings {
        flex-direction: row;
        display: flex;
        flex-wrap: wrap;
        gap: 20px;
        row-gap: 10px;
        margin-bottom: 10px;
    }

    .horizontal_settings .setting {
        flex:1
    }

    .setting label {
        display: block;
        /* font-weight: bold; */
        margin-bottom: 3px;
        font-size: 11pt
    }

    .setting .error {
        min-width: 100%;
        width: 0;
        font-size: 9pt;
        margin-top: 2px;
        color: yellow;

    }

    .checkboxSetting label {
        display: block;
        /* font-weight: bold; */
        margin-bottom: 3px;
        font-size: 11pt;
        display: inline
    }

    .checkboxSetting input {
        margin-right: 10px;
        display: inline;
    }

    .small_input {
        /* width: none; */
        width: 100%;
        min-width: 80px;
        max-width: 100px;
    }


    .slider {
        width: 100%;
        opacity: 0.7; /* Fully shown on mouse-over */

    }

    .slider:hover {
        opacity: 1; /* Fully shown on mouse-over */
    }


    .status {
        position: absolute;
        bottom:0;
        right:0;
        font-family: monospace;
        margin-right: 20px;
        margin-bottom: 20px;
        text-align: left;
        color:v-bind("statusTextColor");
        max-width:350px;
        width:100%
    }

    .time_display {
        font-size: 40pt;
        width: min-content;
    }

    .timeEntryBox {
        font-size: 40pt;
        width: 100%;
        font-family: monospace;
    }

    .time_display:focus, .time_display:hover {
        color:brown
    }

    .subtitle {
        font-size: 12pt;
    }

    input[type=range][orient=vertical] {
        writing-mode: vertical-lr;
        direction: rtl;
        appearance: slider-vertical;
        width: 16px;
        vertical-align: bottom;
    }

    #coordBox {
        background-color: white;
        width: 100%
    }

    #markerPoint {
        width: 10px;
        height: 10px;
        transform: translate(-5px, -5px);
        border-radius: 5px;
        background-color: red;
        grid-row: 1;
        grid-column: 2;
        position: absolute;
        pointer-events: none;
    }

    #mapImage {
        width:100%;
        aspect-ratio: 2 / 1;
        user-select: none
    }
</style>