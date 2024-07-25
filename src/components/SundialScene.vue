<script setup lang="ts">
    import { TresCanvas } from '@tresjs/core';
    import { OrbitControls } from '@tresjs/cientos'
    import { onClickOutside } from '@vueuse/core'

    let isEditingTime = ref<boolean>(false);
    /** What's in the time manual entry box */
    let timeEntryValue = ref<string>("");
    const timeEntryBox = ref<HTMLInputElement | null>(null);   
    function showTimeEntryBox() {
        if (isEditingTime.value == false) {
            isEditingTime.value = true;
            timeEntryValue.value = computeTimeText();

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
    let time = ref<number>(12*60);
    /** 0 to 364 (integer) */
    let day = ref<number>(123);




    // form values.
    const formDefaults = {
        latitude:"52.48",
        longitude:"0.12",
    }

    const formState = reactive(formDefaults);
    const formRules = computed<Record<keyof typeof formDefaults, any>>(() => ({
        latitude: {
            numeric,
            minValue:minValue(-90),
            maxValue:maxValue(90)
        },
        longitude: {
            numeric,
            minValue:minValue(-180),
            maxValue:maxValue(180)
        }
    }))

    const v$ = useVuelidate(formRules, formState)

    function computeSunHorizontalCoords() {
        // using guide from here: https://en.wikipedia.org/wiki/Position_of_the_Sun
        const longitude = Number.parseFloat(formState.longitude);
        const latitude = Number.parseFloat(formState.latitude);
        if (isNaN(longitude) || isNaN(latitude)) {
            return {azimuth:0, altitude:Math.PI/2}
        }
        const longRad = longitude * Math.PI/180;
        const latRad = latitude * Math.PI/180;

        // pretend the year is 2023 (non-leap year)
        // calculate ecliptic coordinates
        const n = 8400.5 + day.value + time.value/1440;
        const L = (4.89495042 + 0.017202792 * n) % (2 * Math.PI);
        const g = (6.240040768 + 0.01720197 * n) % (2 * Math.PI);
        const lambda = L + 0.033423055 * Math.sin(g) + 0.000349066 * Math.sin(2 * g);
        const epsilon = 0.409087723 - 4e-7*Math.PI/180*n;


        // convert to equitorial coords
        const rightAsc = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda));
        const declination = Math.asin(Math.sin(epsilon) * Math.sin(lambda));


        // compute hour angle
        // https://aa.usno.navy.mil/faq/GAST
        /** Greenwich mean sidereal time (converted to hour angle) */
        const GMST = ((18.697375 + 24.065709824279 * n) % 24) * Math.PI/12;
        /** local mean sidereal time */
        const LMST = GMST + longRad;
        /** hour angle */
        const h = LMST - rightAsc;

        // convert to horizontal coords
        // https://en.wikipedia.org/wiki/Astronomical_coordinate_systems
        const azimuth = -Math.atan2(Math.cos(declination) * Math.sin(h), -Math.sin(latRad) * Math.cos(declination) * Math.cos(h) + Math.cos(latRad) * Math.sin(declination));
        const altitude = Math.asin(Math.sin(latRad) * Math.sin(declination) + Math.cos(latRad) * Math.cos(declination) * Math.cos(h));

        return {azimuth, altitude}

    }

    const sunHorizontalCoords = computed(computeSunHorizontalCoords);

    function computeSunCoords(azimuth: number, altitude: number) {
        const multiplyer = 15;
        return {
            x: multiplyer * Math.sin(azimuth) * Math.cos(altitude),
            y: multiplyer * Math.sin(altitude),
            z: multiplyer * -Math.cos(azimuth) * Math.cos(altitude)
        }
    }

    const sunCoords = computed(() => computeSunCoords(sunHorizontalCoords.value.azimuth, sunHorizontalCoords.value.altitude))

    




    let isSunUp = computed(() => time.value > 6*60 && time.value < 18*60);
    let statusTextColor = computed(() => isSunUp.value ? "black" : "white")
    
    function computeTimeText() {
        const timeObj = new Date();
        timeObj.setHours(Math.floor(time.value / 60));
        timeObj.setMinutes(time.value % 60)
        return timeObj.toLocaleTimeString(undefined, { hour: "numeric", minute: "numeric" })
    }
    let timeText = computed(computeTimeText)

    function computeDateText() {
        // add date to an arbitrary non-leap year
        let dateObj = new Date(Date.parse("2001") + day.value * 24 * 60 * 60 * 1000);
        return dateObj.toLocaleDateString(undefined, { month: "long", day: 'numeric' })
    }
    let dateText = computed(computeDateText);

</script>

<template>
    <TresCanvas clear-color="#87CEEB" shadows :shadowMapType="BasicShadowMap" window-size>
        <TresPerspectiveCamera />
        <SundialObject />
        <SunObject :position="[sunCoords.x, sunCoords.y, sunCoords.z]"/>

        <!-- positional light points at :target="[0,0,0]" by default -->
        <TresDirectionalLight :position="[sunCoords.x, sunCoords.y, sunCoords.z]" :intensity="1" :shadow-mapSize-width="2048"
            :shadow-mapSize-height="2048" cast-shadow />
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
                <input class="small_input" v-model.lazy="v$.latitude.$model">
                <div class="error" v-if="v$.latitude.$invalid">{{ v$.latitude.$errors[0].$message}}</div>
            </div>
            <div class="setting">
                <label>Longitude</label>
                <input class="small_input" v-model.lazy="v$.longitude.$model">
                <div class="error" v-if="v$.longitude.$invalid">{{ v$.longitude.$errors[0].$message}}</div>
            </div>
        </div>





        <!-- <input 
            type="range" 
            min="0.01" 
            max="2"
            step="0.01" 
            value="1" 
            class="slider" 
            id="myRange"
            @input="sliderChange"
        >
        <p style="color: white">{{ sliderValue }}</p> -->
    </div>



    <!-- status overlay -->
    <div class="status">

        <div class="time_display" v-show="!isEditingTime" @click="showTimeEntryBox" @keydown.enter="showTimeEntryBox" tabindex="0">{{timeText}}</div>

        <input v-show="isEditingTime" ref="timeEntryBox" class="timeEntryBox" @blur="hideTimeEntryBox" @keydown.enter="hideTimeEntryBox"
            v-model="timeEntryValue">

        <input type="range" min="0" max="1440" step="10" class="slider" id="time" v-model="time">
        <div class="day_display">{{dateText}}</div>

    </div>

</template>


<script lang="ts">
    import { MaybeRef, computed, defineComponent, reactive, ref } from 'vue'
    import SundialObject from "./SundialObject.vue";
    import SunObject from './SunObject.vue';
    import { clamp } from 'three/src/math/MathUtils';
    import { alpha, integer, maxValue, minValue, numeric, required } from '@vuelidate/validators';
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

    .day_display {
        font-size: 12pt;
    }
</style>