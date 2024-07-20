<script setup lang="ts">
    import { TresCanvas } from '@tresjs/core';
    import { OrbitControls } from '@tresjs/cientos'
    
    let sliderValue = ref<number>(1);

    function sliderChange(e: Event) {
        const target = e.target as HTMLInputElement;
        sliderValue.value = parseFloat(target.value)
    }

    // let latitude = ref<number>(0);
    // function setLatitude(e:Event) {
    //     const lat = parseFloat((e.target as HTMLInputElement).value);
    //     if (!isNaN(lat)) {
    //         latitude.value = clamp(lat, -90, 90);
    //     }
    //     console.log(latitude.value)
    // }
    // let longitude = ref<number>(0);

    /** 0 to 24 */
    let time = ref<number>(12);
    /** 0 to 364 (integer) */
    let day = ref<number>(123);




    // form values.
    const formDefaults = {
        latitude:"",
        longitude:"",
    }

    const state = reactive(formDefaults);
    const rules = computed<Record<keyof typeof formDefaults, any>>(() => ({
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

    const v$ = useVuelidate(rules, state)




    let isSunUp = computed(() => time.value > 6 && time.value < 18);
    let statusTextColor = computed(() => isSunUp.value ? "black" : "white")
    
    let timeText = computed(() => {
        const timeObj = new Date();
        timeObj.setHours(time.value);
        timeObj.setMinutes((time.value % 1)*60)
        return timeObj.toLocaleTimeString(undefined, {hour:"numeric", minute: "numeric"})
    })

    let dateText = computed(() => {
        // add date to an arbitrary non-leap year
        let dateObj = new Date(Date.parse("2001") + day.value * 24 * 60 * 60 * 1000);
        return dateObj.toLocaleDateString(undefined, {month:"long", day:'numeric'})
    })

</script>

<template>
    <TresCanvas clear-color="#87CEEB" shadows :shadowMapType="BasicShadowMap" window-size>
        <TresPerspectiveCamera  />
        <SundialObject/>

        <!-- positional light points at :target="[0,0,0]" by default -->
        <TresDirectionalLight
            :position="[50,70,10]"
            :intensity="1"
            :shadow-mapSize-width="2048"
            :shadow-mapSize-height="2048"
            cast-shadow
        />
        <TresAmbientLight color="#AAAAAA" />
        <OrbitControls
            :enable-damping="false"
            :rotate-speed="0.5"
            :enable-pan="false"
        />
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
        <div class="time_display">{{timeText}}</div>
        <div class="day_display">{{dateText}}</div>

    </div>
    
</template>


<script lang="ts">
    import { computed, defineComponent, reactive, ref } from 'vue'
    import SundialObject from "./SundialObject.vue";
    import { clamp } from 'three/src/math/MathUtils';
    import { integer, maxValue, minValue, numeric, required } from '@vuelidate/validators';
    import useVuelidate from '@vuelidate/core';
    import { BasicShadowMap, DirectionalLightShadow, MinEquation } from 'three';
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
        color:v-bind("statusTextColor")
    }

    .time_display {
        font-size: 40pt;
    }

    .day_display {
        font-size: 12pt;
    }
</style>