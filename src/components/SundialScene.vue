<script setup lang="ts">
    import { TresCanvas } from '@tresjs/core';
    import { Line2, OrbitControls } from '@tresjs/cientos'
    import { onClickOutside } from '@vueuse/core'
    import interpolate from "color-interpolate";

    let isEditingTime = ref<boolean>(false);
    /** What's in the time manual entry box */
    let timeEntryValue = ref<string>("");
    const timeEntryBox = ref<HTMLInputElement | null>(null);   
    function showTimeEntryBox() {
        if (isEditingTime.value == false) {
            isEditingTime.value = true;
            timeEntryValue.value = computeTimeText(localTime.value);

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

    // const perspectiveCamera = ref();
    // onMounted(() => {
    //     perspectiveCamera.value.position = [10, 10, 10];
    // })


    /** 0 to 24*60 */
    let localTime = ref<number>(12*60);
    /** 0 to 364 (integer) */
    let day = ref<number>(100);


    const sundialOrigin = [0, -1, 0];
    const sundialNormal = [0, 1, 0];

    // form values.
    const formDefaults = {
        latitude:"52.48",
        longitude:"0.12",
        timeZone:"+0:00"
    }

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
    // TODO figure out how to do this properly
    const longitude = ref<number>(0);
    const latitude = ref<number>(0);
    /** +/- minutes UTC */
    const timeZone = ref<number>(0);
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

    /** convert local time to UTC +0 */
    const time = computed(() => (((localTime.value - timeZone.value) % 1440) + 1440) % 1440)


    const sunHorizontalCoords = computed(() => computeSunHorizontalCoords(day.value, time.value, latitude.value, longitude.value));


    const sunCoords = computed(() => computeSunCoords(sunHorizontalCoords.value.azimuth, sunHorizontalCoords.value.altitude))

    let gnomonRotation = computed(() => {
        return (90-latitude.value)*Math.PI/180
    })




    let isDaytime = computed(() => sunHorizontalCoords.value.altitude >= 0);
    let statusTextColor = computed(() => isDaytime.value ? "black" : "white")
    
    function computeTimeText(time:number) {
        const timeObj = new Date();
        timeObj.setHours(Math.floor(time / 60));
        timeObj.setMinutes(time % 60)
        return timeObj.toLocaleTimeString(undefined, { hour: "numeric", minute: "numeric" })
    }
    let timeText = computed(() => computeTimeText(localTime.value))

    function computeDateText(day: number) {
        // add date to an arbitrary non-leap year
        let dateObj = new Date(Date.parse("2001") + day * 24 * 60 * 60 * 1000);
        return dateObj.toLocaleDateString(undefined, { month: "long", day: 'numeric' })
    }
    let dateText = computed(() => computeDateText(day.value));

    let meanSolarTime = computed(() => time.value + ((longitude.value/360)*24*60));
    let meanSolarTimeText = computed(() => computeTimeText(meanSolarTime.value));

    let apparentSolarTime = computed(() => {
        // use the already-computed sun position. This isn't actualy dependent on the latitude irl. Just seemed the easiest way to do it here.
        // to calculate this, rotate sun position (90°-latitude) anticlockwise about x axis (west to east axis). Then work out projected angle in the x/z (horizontal) plain.
        const latRad = latitude.value * Math.PI/180;
        const timeHours = Math.atan2(sunCoords.value.y * Math.cos(latRad) + sunCoords.value.z * Math.sin(latRad), sunCoords.value.x) * 12 / Math.PI + 6;
        const timeMins = (((timeHours % 24) + 24) % 24) * 60;
        return timeMins;
    })
    let apparentSolarTimeText = computed(() => computeTimeText(apparentSolarTime.value))

    let timeZoneText = computed(() => {
        const symbol = timeZone.value > 0 ? "+"
            : timeZone.value < 0 ? "-"
                : "±";
        const hours = Math.abs(Math.trunc(timeZone.value / 60));
        const mins = Math.abs(timeZone.value % 60);
        let result = symbol + hours.toString();
        if (mins != 0) result += ":" + mins.toString();
        return result;
    })

    let sunlightIntensity = computed(() => {
        let intensity = Math.cos(Math.PI / 2 - sunHorizontalCoords.value.altitude * 0.8);
        if (intensity < 0) intensity = 0;
        return intensity;
    })

    let skyColor = computed(() => {
        let color = interpolate(["#02407a", "#87CEEB"])(1-(1 - sunlightIntensity.value) ** 8);
        return color;
    })

    let stylePlateIntersectionPoint = computed(() => {
        // intersect the plane of the plate with the line of the sundial gnomon.
        const plane = new Plane(new Vector3(0, 1, 0), 1);
        const rayDir = new Vector3(0, -(Math.sin(latitude.value * Math.PI / 180)), (Math.cos(latitude.value * Math.PI / 180)));

        // rays are only infinite in 1 direction. Need 2 rays, try both
        const ray = new Ray(new Vector3(0, 0, 0), rayDir);
        let intersection = ray.intersectPlane(plane, new Vector3())
        if (!intersection) {
            const ray2 = new Ray(new Vector3(0, 0, 0), rayDir.clone().multiplyScalar(-1));
            intersection = ray2.intersectPlane(plane, new Vector3())
        }

        return intersection;
    })

    let hourLines = computed(() => {
        // angles of each hour line.
        const angles = [...Array(12).keys()].map(i => computeShadowDirection(i * 60*Math.PI*2/1440, latitude.value * Math.PI / 180, new Vector3(...sundialNormal)));
        
        if (stylePlateIntersectionPoint.value) {
            // return angles.map((angle, i) => ({
            //     hour: i,
            //     points: [
            //         stylePlateIntersectionPoint.value as Vector3,
            //         (stylePlateIntersectionPoint.value as Vector3).clone().add(angle.multiplyScalar(10))
            //     ]
            // }))

            // clip each shadow-line with a sphere centered on the plate origin.
            return angles.map((shadowDir, i) => {
                const r = 5;
                
                const origin = new Vector3(...sundialOrigin);
                const plateStyleIntersection = new Vector3(...stylePlateIntersectionPoint.value as Vector3);
                
                // intersections with the sphere and r = plateStyleIntersection + λ * shadowDir
                // find values of λ
                const c = Math.pow(origin.distanceTo(plateStyleIntersection), 2) - Math.pow(r, 2);
                const b = origin.clone().sub(plateStyleIntersection).multiply(shadowDir).dot(new Vector3(1,1,1)) * -2;
                const a = Math.pow(shadowDir.length(), 2);

                const discriminant = Math.pow(b, 2) - 4*a*c;
                if (discriminant <= 0) return {hour:i, points:undefined};

                // roots.
                // plus that: we don't want to show any part of the line where lambda is negative
                const lambda0 = (-b - Math.sqrt(discriminant)) / (2 * a)
                const lambda1 = (-b + Math.sqrt(discriminant)) / (2 * a)

                return {
                    hour: i,
                    points: [
                        shadowDir.clone().multiplyScalar(lambda0).add(plateStyleIntersection),
                        shadowDir.clone().multiplyScalar(lambda1).add(plateStyleIntersection),
                    ]
                }

            })
        }

        else {
            // special case when style is parallel to the plate.
            // todo
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
        <SundialObject :gnomon-rotation="gnomonRotation" :origin="sundialOrigin"/>
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
        <!-- town selector -->
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
    import { MaybeRef, computed, defineComponent, onMounted, reactive, ref, watch } from 'vue'
    import SundialObject from "./SundialObject.vue";
    import SunObject from './SunObject.vue';
    import { clamp } from 'three/src/math/MathUtils';
    import { alpha, decimal, helpers, integer, maxValue, minValue, numeric, required } from '@vuelidate/validators';
    import useVuelidate from '@vuelidate/core';
    import { BasicShadowMap, DirectionalLightShadow, MinEquation, Vector3, Plane, Line3, Ray } from 'three';
import { RefSymbol } from '@vue/reactivity';
import { computeShadowDirection, computeSunCoords, computeSunHorizontalCoords } from '@/calculations';
    export default defineComponent({
        // props: {

        // },
        components: {
        },
        
    })
</script>

<style scoped>
    .sidebar {
        width: 30%;
        background: rgba(39, 39, 39, 0.95);
        position: absolute;
        left: 0;
        top:0;
        height: 100%;
        padding: 20px;
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
</style>