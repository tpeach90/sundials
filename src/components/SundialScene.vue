<script setup lang="ts">
    import { TresCanvas } from '@tresjs/core';
    import { OrbitControls } from '@tresjs/cientos'
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

            /** @todo this doesn't work because it is not yet mounted */
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




    
    // let sliderValue = ref<number>(1);

    // function sliderChange(e: Event) {
    //     const target = e.target as HTMLInputElement;
    //     sliderValue.value = parseFloat(target.value)
    // }

    // let latitude = ref<number>(0);
    // function setLatitude(e:Event) {
    //     const lat = parseFloat((e.target as HTMLInputElement).value);
    //     if (!isNaN(lat)) {
    //         latitude.value = clamp(lat, -90, 90);
    //     }
    //     console.log(latitude.value)
    // }
    // let longitude = ref<number>(0);

    /** 0 to 24*60 */
    let localTime = ref<number>(12*60);
    /** 0 to 364 (integer) */
    let day = ref<number>(100);




    // form values.
    const formDefaults = {
        latitude:"52.48",
        longitude:"0.12",
        timeZone:"+1:00"
    }
    // const formDefaults = {
    //     latitude: "",
    //     longitude: ""
    // }

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
            timeZone.value = (result[1] == "-" ? -1 : 1) * (Number.parseInt(result[2]) * 60 + Number.parseInt(result[3] ?? 0))
        }
    }, {immediate:true})

    /** convert local time to UTC +0 */
    const time = computed(() => (((localTime.value - timeZone.value) % 1440) + 1440) % 1440)



    // const longitude = computed(() => {
    //     return Number.parseFloat(v$.value.longitude.);
    //     // if (v$.value.longitude.$error) return 0;
    //     // const l = Number.parseFloat(formState.longitude);
    //     // return isNaN(l) ? 0 : l;
    // });
    // const latitude = computed(() => {
    //     return Number.parseFloat(formState.latitude);

    //     // if (v$.value.latitude.$error) return 0;
    //     // const l = Number.parseFloat(formState.latitude);
    //     // return isNaN(l) ? 0 : l;
    // }, );



    /**
     * Compute the sun's position in horizontal coordinates, using the current date, time, latitude, and longitude.
     */
    function computeSunHorizontalCoords(day: number, time: number, latitude: number, longitude: number) {
        // using guide from here: https://en.wikipedia.org/wiki/Position_of_the_Sun

        const longRad = longitude * Math.PI/180;
        const latRad = latitude * Math.PI/180;

        // pretend the year is 2023 (non-leap year)
        // calculate ecliptic coordinates
        const n = 8400.5 + day + time/1440;
        const L = (4.89495042 + 0.017202792 * n) % (2 * Math.PI);
        const g = (6.240040768 + 0.01720197 * n) % (2 * Math.PI);
        const lambda = L + 0.033423055 * Math.sin(g) + 0.000349066 * Math.sin(2 * g);
        const epsilon = 0.409087723 - 4e-7*Math.PI/180*n;


        // convert to equitorial coords
        const rightAsc = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda));
        const declination = Math.asin(Math.sin(epsilon) * Math.sin(lambda));


        // compute hour angle
        // https://aa.usno.navy.mil/faq/GAST
        // /** Greenwich mean sidereal time (converted to hour angle) */
        // const GMST = ((18.697375 + 24.065709824279 * n) % 24) * Math.PI/12;
        
        // earth rotation angle
        // const ERA = 2 * Math.PI * ((0.7790572732640 + 1.00273781191135448 * n) % 1);
        const ERA = 2 * Math.PI * ((0.7790572732640 + 1.002737811911355 * n) % 1);

        /** local mean sidereal time */
        const LMST = ERA + longRad;
        /** hour angle */
        const h = LMST - rightAsc;

        // convert to horizontal coords
        // https://en.wikipedia.org/wiki/Astronomical_coordinate_systems
        const azimuth = -Math.atan2(Math.cos(declination) * Math.sin(h), -Math.sin(latRad) * Math.cos(declination) * Math.cos(h) + Math.cos(latRad) * Math.sin(declination));
        const altitude = Math.asin(Math.sin(latRad) * Math.sin(declination) + Math.cos(latRad) * Math.cos(declination) * Math.cos(h));

        return {azimuth, altitude}

    }

    const sunHorizontalCoords = computed(() => computeSunHorizontalCoords(day.value, time.value, latitude.value, longitude.value));

    function computeSunCoords(azimuth: number, altitude: number) {
        const multiplyer = 15;
        return {
            x: multiplyer * Math.sin(azimuth) * Math.cos(altitude),
            y: multiplyer * Math.sin(altitude),
            z: multiplyer * -Math.cos(azimuth) * Math.cos(altitude)
        }
    }

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

</script>

<template>
    <TresCanvas :clear-color="skyColor" shadows :shadowMapType="BasicShadowMap" window-size>
        <TresPerspectiveCamera />
        <SundialObject :gnomon-rotation="gnomonRotation" />
        <SunObject :position="[sunCoords.x, sunCoords.y, sunCoords.z]" />

        <!-- directional light points at :target="[0,0,0]" by default -->
        <TresDirectionalLight :position="[sunCoords.x, sunCoords.y, sunCoords.z]" :intensity="1"
            :shadow-mapSize-width="2048" :shadow-mapSize-height="2048" cast-shadow />
        <TresAmbientLight color="#AAAAAA" />
        <OrbitControls :enable-damping="false" :rotate-speed="0.5" :enable-pan="false" />
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
                <div class="subtitle" >{{ isDaytime ? "☀️" : "🌙" }}</div>
                <div class="subtitle" >UTC {{ timeZoneText }}</div>
            </div>


        </div>



        <div class="subtitle">{{ meanSolarTimeText }} mean solar time</div>
        <div class="subtitle">{{ apparentSolarTimeText }} apparent solar time</div>




        <input type="range" min="0" max="1440" step="10" class="slider" id="time" v-model.number="localTime">
        <div class="subtitle">{{dateText}}</div>

    </div>

</template>


<script lang="ts">
    import { MaybeRef, computed, defineComponent, reactive, ref, watch } from 'vue'
    import SundialObject from "./SundialObject.vue";
    import SunObject from './SunObject.vue';
    import { clamp } from 'three/src/math/MathUtils';
    import { alpha, decimal, helpers, integer, maxValue, minValue, numeric, required } from '@vuelidate/validators';
    import useVuelidate from '@vuelidate/core';
    import { BasicShadowMap, DirectionalLightShadow, MinEquation } from 'three';
import { RefSymbol } from '@vue/reactivity';
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