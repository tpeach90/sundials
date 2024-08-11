<!-- Main file, controlling the interface and calculations. -->

<script setup lang="ts">

    import { TresCanvas } from '@tresjs/core';


    /*
     * Config
     */
    const sundialOrigin = [0, -1, 0];
    const sundialNormal = [0, 1, 0];

    /*
     * Independent variables
     */
    /** 0 to 24*60 */
    let localTime = ref<number>(12 * 60);
    /** 0 to 364 (integer) */
    let day = ref<number>(100);
    let longitude = ref<number>(0);
    let latitude = ref<number>(0);
    /** +/- minutes UTC */
    let timeZone = ref<number>(0);


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
    const timeZoneRegex = /^\s*([+-]?)\s*((?:0?[0-9])|1[0-9])(?::((?:0[0-9])|[1-5][0-9]))?\s*$/;

    const formState = reactive(formDefaults);
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
        if (!v$.value.longitude.$invalid) longitude.value = Number.parseFloat(newVal);
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
    function mapImageMouseMove(e:MouseEvent) {
        if (mapImage.value && mapImageIsBeingClicked.value) {
            const longitude = e.offsetX / mapImage.value.width * 360 - 180;
            const latitude = 90 - e.offsetY / mapImage.value.height * 180;
            formState.longitude = longitude.toFixed(1);
            formState.latitude = latitude.toFixed(1);
        }
    }
    function mapImageStartClicking() {
        mapImageIsBeingClicked.value = true;
    }
    onMounted(() => {
        window.addEventListener("mouseup", () => {
            mapImageIsBeingClicked.value = false;
        })
    })


    /**
     * computed values
     */
    /** convert local time to UTC +0 */
    let time = computed(() => (((localTime.value - timeZone.value) % 1440) + 1440) % 1440)
    let sunHorizontalCoords = computed(() => calculateSunHorizontalCoords(day.value, time.value, latitude.value, longitude.value));
    let sunCoords = computed(() => horizontalToActualCoords(sunHorizontalCoords.value.azimuth, sunHorizontalCoords.value.altitude))
    let gnomonRotation = computed(() => (90-latitude.value)*Math.PI/180);
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
        let intensity = Math.cos(Math.PI / 2 - sunHorizontalCoords.value.altitude * 0.8);
        if (intensity < 0) intensity = 0;
        return intensity;
    })
    let skyColor = computed(() => {
        // raise to a high power so brightness stays the same throughout most of the time the sun is up
        // to simulate eyes adjusting to the changing brightness
        return interpolate(["#02407a", "#87CEEB"])(1-(1 - sunlightIntensity.value) ** 8);
    })
    let stylePlateIntersectionPoint = computed(() => {
        // intersect the plane of the plate with the line of the sundial gnomon.
        const plane = new Plane(new Vector3(0, 1, 0), 1);
        const rayDir = new Vector3(0, -(Math.sin(latitude.value * Math.PI / 180)), (Math.cos(latitude.value * Math.PI / 180)));
        return infiniteLineIntersectWithPlane(plane, new Vector3(0,0,0), rayDir);

    })
    let hourLines = computed(() => {
        // angles of each hour line. only need 12 lines because they extend in both directions from the style/plate intersection point
        // i.e. the line for 7am also doubles as the line for 7pm, etc.
        const angles = [...Array(12).keys()].map(i => calculateShadowDirection(i * 60*Math.PI*2/1440, latitude.value * Math.PI / 180, new Vector3(...sundialNormal)));
        
        if (stylePlateIntersectionPoint.value) {
            // to get the portion of the line we want, intersect each hour line with a sphere centered on the sundial plate origin.
            return angles.map((shadowDir, i) => ({
                hour: i,
                points: infiniteLineIntersectWithSphere(new Vector3(...sundialOrigin), 5, stylePlateIntersectionPoint.value as Vector3, shadowDir)
            }))
        }
        else {
            // special case when style is parallel to the plate, and the style/plate intersection point does not exist
            /** @todo */
            return angles.map((angle, i) => ({
                hour:i,
                points: [new Vector3(0, 0, 0), new Vector3(0, 0, -1)]
            }))
        }
    })

</script>

<template>
    <TresCanvas :clear-color="skyColor" shadows :shadowMapType="BasicShadowMap" window-size>
        <TresPerspectiveCamera />
        <SundialObject :gnomon-rotation="gnomonRotation" :origin="sundialOrigin" />
        <SunObject :position="[sunCoords.x, sunCoords.y, sunCoords.z]" />
        <template v-for="hourLine in hourLines" v-bind:key="hourLine.hour">
            <Line2 :points="hourLine.points ?? [[0,0,0], [0,0,0]]" :line-width="0.002" />
        </template>

        <!-- directional light points at :target="[0,0,0]" by default -->
        <TresDirectionalLight :position="[sunCoords.x, sunCoords.y, sunCoords.z]" :intensity="1"
            :shadow-mapSize-width="2048" :shadow-mapSize-height="2048" cast-shadow />
        <TresAmbientLight color="#AAAAAA" />
        <OrbitControls :enable-damping="false" :rotate-speed="0.5" :enable-pan="false" :target="[0,0,0]" />
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
        
        <!-- interactive selector -->
        <div>
            <div style="display: grid; grid-template-columns: min-content auto;">
                <input style="grid-row: 1; grid-column: 1; height:100%" type="range" min="-90" max="90" step="-0.1"
                    class="slider" orient="vertical" v-model="v$.latitude.$model">
                <!-- <div id="coordBox" style="grid-row: 1; grid-column: 2;"></div> -->
                <div style="position:relative">
                    <!-- @todo image has a slight offset -->
                    <img src="./assets/world-map-cropped.png" id="mapImage"
                        alt="An outline world map, on which the user can click to set the latitude and longitude."
                        style="grid-row: 1; grid-column: 2"
                        draggable="false" @mousemove="mapImageMouseMove" @mousedown="mapImageStartClicking" ref="mapImage">
                    <div id="markerPoint"
                        :style="`top:${(90 - latitude) * 100 / 180}%; left:${(longitude+180) * 100 / 360}%`"></div>
                </div>

                <input style="grid-row: 2; grid-column: 2" type="range" min="-180" max="180" step="0.1" class="slider"
                    v-model="v$.longitude.$model">
            </div>

        </div>
    </div>



    <!-- status overlay -->
    <div class="status">

        <div style="display:flex; flex-direction: row;">
            <div class="time_display" v-show="!isEditingTime" @click="showTimeEntryBox"
                @keydown.enter="showTimeEntryBox" tabindex="0">{{ timeText }}</div>
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
    import { BasicShadowMap, Vector3, Plane,} from 'three';
    import { dateToString, calculateShadowDirection, horizontalToActualCoords, calculateSunHorizontalCoords, timeToString, timeZoneToString, infiniteLineIntersectWithPlane, infiniteLineIntersectWithSphere } from '@/calculations';
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
        background: rgba(39, 39, 39, 0.95);
        position: absolute;
        left: 0;
        top:0;
        height: 100%;
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
    }

    .setting .error {
        min-width: 100%;
        width: 0;
        font-size: 9pt;
        margin-top: 2px;
        color: yellow;

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