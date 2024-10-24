<!-- Main file, controlling the interface and calculations. -->

<script setup lang="ts">

    import { TresCanvas } from '@tresjs/core';
    
    /*
     * Config
     */
    const sundialOrigin = new Vector3(0, -0.5, 0);
    const sundialRadius = 5;
    const projectionRadius = 4;
    const numeralDistanceFromSundialOrigin = 4;
    const zoomSpeed = 3;

    
    /*
     * Independent variables 
     */
    /** 0 to 24*60 */
    let localTime = ref<number>(12 * 60);
    /** 0 to 364 (integer) */
    let day = ref<number>(162);
    let longitude = ref<number>(0);
    let latitude = ref<number>(0);
    let autoSelectTimeZone = ref(true);
    /** +/- minutes UTC */
    let timeZone = ref<number>(0);
    // let numerals = ref<"roman"|"arabic">("arabic");
    let sunRaysPassThroughEarth = ref(false);
    let hourLineStyle = ref<"solar"|"standard">("standard");
    let sundialType = ref<"dialAndGnomon" | "pointSundial">("dialAndGnomon")
    /**Camera position multiplier. < 1 zoom in, > 1 zoom out */
    let currentZoomPerSecond = ref<number>(1);
    let sundialRotation = ref<Euler>(new Euler(0,0,0, "YXZ"));
    let gnomonHeight = ref<number>(1)

    /**
     * readonly variables
     */
    let cameraPosition = ref<Vector3>()



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

            nextTick(() => timeEntryBox.value?.focus());
            
        }
    }
    function updateTimeFromEntryBox() {
        if (!timeEntryBox.value) return;

        const newTime = stringToTime(timeEntryBox.value.value);
        if (isNaN(newTime)) return;

        localTime.value = newTime;
    }
    function hideTimeEntryBox() {
        if (isEditingTime.value == true) {
            isEditingTime.value = false
            
            updateTimeFromEntryBox()
        }
    }
    onClickOutside(timeEntryBox, hideTimeEntryBox)


    /*
     * Sidebar form validation 
     */
    const formDefaults = {
        latitude:"45.00",
        longitude:"0.00",
        timeZone:"+0:00",
        slant:"0",
        rotation:"0",
        gnomonHeight:"1"
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
        },
        slant: {
            required,
            decimal,
            minValue:minValue(0),
            maxValue:maxValue(180)
        },
        rotation: {
            required,
            decimal,
            minValue:minValue(-180),
            maxValue:maxValue(180)
        },
        gnomonHeight: {
            required,
            decimal,
            minValue:minValue(0.5),
            maxValue:maxValue(3)
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
    watch(() => formState.slant, newVal => {
        if (!v$.value.slant.$invalid) sundialRotation.value.x = Number.parseFloat(newVal) * Math.PI/180;
    }, {immediate: true})
    watch(() => formState.rotation, newVal => {
        if (!v$.value.rotation.$invalid) sundialRotation.value.y = -Number.parseFloat(newVal) * Math.PI / 180;
    }, { immediate: true })
    watch(() => formState.gnomonHeight, newVal => {
        if (!v$.value.gnomonHeight.$invalid) gnomonHeight.value = Number.parseFloat(newVal);
    }, { immediate: true })

    /*
    * Help popups
    */
    const instance = getCurrentInstance();
    let showThreeTimesExplanation = ref(false);
    function toggleWalkthrough() {
        const wt = instance?.appContext.config.globalProperties.$tours['walkthrough'];
        if (!wt) return;
        if (wt.isRunning.value) {
            wt.stop()
        } else {
            hideAllPoppers()
            wt.start()
        }
    }
    function hideAllPoppers() {
        instance?.appContext.config.globalProperties.$tours['walkthrough'].finish()
        showThreeTimesExplanation.value = false;
    }
    function setShowThreeTimesExplanation(show: boolean) {
        if (show) {
            hideAllPoppers()
        }
        showThreeTimesExplanation.value = show
    }

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

    // global mouse released fn
    onMounted(() => {
        window.addEventListener("mouseup", () => {
            mapImageIsBeingClicked.value = false;
        })
    })

    // get the dimensions of the sidebar for layout
    let sidebarDims = ref({ clientWidth: 0, clientHeight: 0 });
    const sidebar = ref<HTMLDivElement>();
    const sidebarResizeObserver = new ResizeObserver(() => {
        const clientWidth = sidebar.value?.clientWidth ?? 0;
        const clientHeight = sidebar.value?.clientHeight ?? 0;
        sidebarDims.value = { clientWidth, clientHeight }
    })
    onMounted(() => {
        sidebarResizeObserver.observe(sidebar.value as HTMLDivElement);
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
    /** relative to sundial origin and rotation */
    const gnomonRelativePosition = computed(() => new Vector3(0, gnomonHeight.value, 0));
    const nodusRelativePosition = computed(() => new Vector3(0, gnomonHeight.value, 0));
    /** convert local time to UTC +0 */
    const time = computed(() => (((localTime.value - timeZone.value) % 1440) + 1440) % 1440)
    const sunHorizontalCoords = computed(() => calculateSunHorizontalCoords(day.value, time.value, latitude.value, longitude.value));
    const sunCoords = computed(() => horizontalToActualCoords(sunHorizontalCoords.value.azimuth, sunHorizontalCoords.value.altitude))
    // let gnomonRotation = computed(() => (90-latitude.value)*Math.PI/180);
    const isDaytime = computed(() => sunHorizontalCoords.value.altitude >= 0);
    const statusTextColor = computed(() => isDaytime.value ? "black" : "white")
    const timeText = computed(() => timeToString(localTime.value))
    const dateText = computed(() => dateToString(day.value));
    const meanSolarTime = computed(() => time.value + ((longitude.value/360)*24*60));
    const meanSolarTimeText = computed(() => timeToString(meanSolarTime.value));
    const apparentSolarTime = computed(() => {
        // use the already-computed sun position. This isn't actualy dependent on the latitude irl. Just seemed the easiest way to do it here.
        // to calculate this, rotate sun position (90°-latitude) anticlockwise about x axis (west to east axis). Then work out projected angle in the x/z (horizontal) plane.
        const latRad = latitude.value * Math.PI/180;
        const timeHours = Math.atan2(sunCoords.value.y * Math.cos(latRad) + sunCoords.value.z * Math.sin(latRad), sunCoords.value.x) * 12 / Math.PI + 6;
        const timeMins = (((timeHours % 24) + 24) % 24) * 60;
        return timeMins;
    })
    const apparentSolarTimeText = computed(() => timeToString(apparentSolarTime.value))
    const timeZoneText = computed(() => timeZoneToString(timeZone.value))
    const sunlightIntensity = computed(() => {
        // a very unscientific way of calculating the apparent sunlight intensity.
        // have a little bit of sunlight when the sun is below the horizon.
        if (sunHorizontalCoords.value.altitude > 0.1) return 1;
        if (sunHorizontalCoords.value.altitude > -0.1) return (sunHorizontalCoords.value.altitude + 0.1)/0.2;
        return 0;
    })
    const skyColor = computed(() => {
        // make the sky look nice innit
        return interpolate(["#02407a", "#87CEEB"])(sunlightIntensity.value);
    })
    const compassRotation = computed(() => {

        if (!cameraPosition.value) {
            return new Euler()
        }

        const cameraDistance = cameraPosition.value.distanceTo(new Vector3(0,0,0))
        const altitude = Math.asin(cameraPosition.value.y/cameraDistance);
        const azimouth = Math.atan2(cameraPosition.value.z, cameraPosition.value.x)
        return new Euler(altitude - Math.PI / 2, azimouth - Math.PI/2, 0, 'XYZ')
    })

    // move all inline processing stuff in the <Tres...> tag props here because this is necessary for some reason to make tresjs render frames on demand
    const showDialAndGnomonSundial = computed(() => sundialType.value === "dialAndGnomon")
    const showPointSundial = computed(() => sundialType.value === "pointSundial")
    const sunCoordsArray = computed<[number, number, number]>(() => [sunCoords.value.x, sunCoords.value.y, sunCoords.value.z])
    const directionalLightIntensity = computed(() => sunRaysPassThroughEarth.value ? 1 : sunlightIntensity.value)
    const cameraXOffset = computed(() => -(sidebarDims.value.clientWidth)/2)

   

</script>

<template>

    <v-tour name="walkthrough" :steps="walkthroughSteps" :options="{
        labels: {
            buttonSkip: 'Close',
            buttonPrevious: 'Previous',
            buttonNext: 'Next',
            buttonStop: 'Finish'
        }
    }" />

    <!-- setting the canvas to window-size messes up the Line2 rendering for some reason. Instead, make it fill an entire screen div. -->
    <div style="width:100%; height:100%; position: fixed; left:0; top:0">
        <TresCanvas :clear-color="skyColor" shadows :shadowMapType="BasicShadowMap" render-mode="on-demand">
            <TresPerspectiveCamera />
            <DialAndGnomonSundial :show="showDialAndGnomonSundial" :latitude="latitude" :longitude="longitude"
                :origin="sundialOrigin" :rotation="sundialRotation" :gnomon-position="gnomonRelativePosition"
                :radius="sundialRadius" :hourLineStyle="hourLineStyle" :time-zone="timeZone"
                :numeralDistanceFromSundialOrigin="numeralDistanceFromSundialOrigin" />

            <PointSundial :show="showPointSundial" :latitude="latitude" :longitude="longitude"
                :origin="sundialOrigin" :rotation="sundialRotation" :gnomon-position="nodusRelativePosition"
                :radius="projectionRadius" :hourLineStyle="hourLineStyle" :time-zone="timeZone" />

            <SunObject :position="sunCoords" />


            <!-- directional light points at :target="[0,0,0]" by default -->
            <TresDirectionalLight :position="sunCoordsArray"
                :intensity="directionalLightIntensity" :shadow-mapSize-width="2048"
                :shadow-mapSize-height="2048" cast-shadow />
            <TresAmbientLight color="#AAAAAA" />
            <TresGridHelper :args="[50, 50, '#AAAAAA', '#AAAAAA']" :position="[0, -8, 0]" />
            <CameraHelper :x-offset="cameraXOffset" :zoom-per-second="currentZoomPerSecond"
                @cameraPosChange="pos => cameraPosition = pos" />
            <RendererHelper />
        </TresCanvas>
    </div>

    <div id="overlay">

        <div id="sidebar" ref="sidebar">
            <div id="sidebarContent">

                <a class="sidebar_link" @click="e => {e.preventDefault();toggleWalkthrough()}"
                    href="javascript:void(0)">walkthrough</a>
                ·
                <a class="sidebar_link" href="https://github.com/tpeach90/sundials/" style="text-decoration: none"
                    target="_blank" title="Source code on github.com">
                    <span style="text-decoration:underline">code</span>
                    <img src="./assets/github-mark-white.svg" style="height:1em; margin-left: 0.2em;"
                        alt="GitHub logo" />
                </a>


                <!-- Position -->
                <h2>Coordinates</h2>
                <div data-v-walkthrough="map">
                    <div class="horizontal_settings">
                        <div class="setting">
                            <label class="fieldTitle">Latitude/°</label>
                            <input class="small_input" v-model="v$.latitude.$model">
                            <div class="error" v-if="v$.latitude.$dirty && v$.latitude.$invalid">{{
                                v$.latitude.$errors[0].$message}}</div>
                        </div>
                        <div class="setting">
                            <label class="fieldTitle">Longitude/°</label>
                            <input class="small_input" v-model="v$.longitude.$model">
                            <div class="error" v-if="v$.longitude.$dirty &&v$.longitude.$invalid">{{
                                v$.longitude.$errors[0].$message}}</div>
                        </div>
                        <div class="setting">
                            <label class="fieldTitle">Time Zone/±UTC</label>
                            <input class="small_input" v-model="v$.timeZone.$model">
                            <div class="error" v-if="v$.timeZone.$dirty && v$.timeZone.$invalid">{{
                                v$.timeZone.$errors[0].$message }}</div>
                        </div>
                    </div>

                    <!-- interactive location selector -->
                    <div
                        style="display: grid; grid-template-columns: min-content auto; grid-template-rows: min-content auto;">
                        <input
                            style="grid-row: 1; grid-column: 1; margin-right:10px; height:100%; margin-top: 0px; margin-bottom:0px;"
                            type="range" min="-90" max="90" step="-0.1" class="slider" orient="vertical"
                            v-model="v$.latitude.$model">
                        <!-- <div id="coordBox" style="grid-row: 1; grid-column: 2;"></div> -->
                        <div style="position:relative; aspect-ratio: 2 / 1;">
                            <img src="./assets/world-map-coordinates-correct.png" id="mapImage"
                                alt="An outline world map, on which the user can click to set the latitude and longitude."
                                style="grid-row: 1; grid-column: 2; object-fit: contain; display:block; margin:0px"
                                draggable="false" @mousemove="mapImageMouseMove" @mousedown="mapImageStartClicking"
                                @click="mapImageClick" ref="mapImage">
                            <div id="markerPoint"
                                :style="`top:${(90 - latitude) * 100 / 180}%; left:${(longitude+180) * 100 / 360}%`">
                            </div>
                        </div>

                        <input style="grid-row: 2; grid-column: 2; margin-top:10px; margin-left:0px; margin-right:0px"
                            type="range" min="-180" max="180" step="1" class="slider" v-model="v$.longitude.$model">
                    </div>
                </div>


                <div class="setting" data-v-walkthrough="time-zone">
                    <input type="checkbox" id="autoSelectTimeZone" v-model="autoSelectTimeZone"
                        style="margin-right: 10px; display: inline;">
                    <label for="autoSelectTimeZone" class="fieldOption">Automatically set time zone</label>
                </div>

                <br>
                <h2>Sundial Settings</h2>

                <div class="setting" data-v-walkthrough="sundial-type">
                    <div class="checkboxSetting" style="display:flex; flex-direction:row; align-items:center">
                        <label for="dialAndGnomon" style="margin-right:10px">
                            <img src="./assets/sundialicon.svg" style="max-width:50px" alt="Traditional sundial icon" />
                        </label>
                        <div>
                            <input type="radio" id="dialAndGnomon" value="dialAndGnomon" v-model="sundialType">
                            <label for="dialAndGnomon" class="fieldOption">
                                Traditional sundial
                            </label>
                        </div>
                    </div>
                    <div class="checkboxSetting" style="display:flex; flex-direction:row; align-items:center">
                        <label for="pointSundial" style="margin-right:10px">
                            <img src="./assets/pointshadowtraceicon.svg" style="max-width:50px"
                                alt="Point shadow trace icon" />
                        </label>
                        <div>
                            <input type="radio" id="pointSundial" value="pointSundial" v-model="sundialType">
                            <label for="pointSundial" class="fieldOption">
                                Point shadow trace
                            </label>
                        </div>
                    </div>
                </div>

                <br>
                <div data-v-walkthrough="slant-and-rotation">

                    <div class="setting">
                        <label class="fieldTitle">Slant/°</label>
                        <input class="small_input" v-model="v$.slant.$model">
                        <div class="error" v-if="v$.slant.$dirty && v$.slant.$invalid">{{
                            v$.slant.$errors[0].$message }}</div>
                        <input type="range" :min="0" :max="180" step="1" class="slider" v-model="v$.slant.$model">
                    </div>
                    <div class="setting">
                        <label class="fieldTitle">Rotation/°</label>
                        <input class="small_input" v-model="v$.rotation.$model">
                        <div class="error" v-if="v$.rotation.$dirty && v$.rotation.$invalid">{{
                            v$.rotation.$errors[0].$message }}</div>
                        <input type="range" :min="-180" :max="180" step="1" class="slider" v-model="v$.rotation.$model">
                    </div>
                    <div class="setting">
                        <label class="fieldTitle">{{ sundialType == "dialAndGnomon" ? "Gnomon" : "Nodus" }}
                            height</label>
                        <input class="small_input" v-model="v$.gnomonHeight.$model">
                        <div class="error" v-if="v$.gnomonHeight.$dirty && v$.gnomonHeight.$invalid">{{
                            v$.gnomonHeight.$errors[0].$message }}</div>
                        <input type="range" :min="0.5" :max="3" step="0.05" class="slider"
                            v-model="v$.gnomonHeight.$model">
                    </div>
                </div>
                <div class="setting" data-v-walkthrough="hour-lines">
                    <label class="fieldTitle">Hour lines</label>
                    <div class="checkboxSetting">
                        <input type="radio" id="standardLines" value="standard" v-model="hourLineStyle">
                        <label for="standardLines" class="fieldOption">Adjusted for time zone and longitude</label>
                    </div>
                    <div class="checkboxSetting">
                        <input type="radio" id="solarLines" value="solar" v-model="hourLineStyle">
                        <label for="solarLines" class="fieldOption">Solar time</label>
                    </div>
                </div>

                <!-- <br>
                <div class="setting">
                    <label class="fieldTitle">Numerals</label>
                    <div class="checkboxSetting">
                        <input type="radio" id="arabic" value="arabic" v-model="numerals">
                        <label for="arabic" class="fieldOption">Western Arabic (0-23)</label>
                    </div>
                    <div class="checkboxSetting">
                        <input type="radio" id="roman" value="roman" v-model="numerals">
                        <label for="roman" class="fieldOption">Roman (I-XXIV)</label>
                    </div>
                </div> -->

                <br>
                <h2>Misc</h2>
                <div class="checkboxSetting">
                    <input type="checkbox" id="sunRaysPassThroughEarth" v-model="sunRaysPassThroughEarth">
                    <label for="sunRaysPassThroughEarth" class="fieldOption">Sundial remains illuminated at
                        night</label>
                </div>

                <br>
            </div>

        </div>

        <!-- top right controls -->
        <div id="topRightControls">
            <div id="compassContainer" title="North">
                <TresCanvas render-mode="on-demand">
                    <TresAmbientLight color="#FFFFFF" :intensity="2" />
                    <TresOrthographicCamera :position="[0, 10, 0]" :lookAt="[0, 0, 0]" :zoom="15" />
                    <CompassObject :rotation="compassRotation" />
                </TresCanvas>
                <div style="position:absolute; width:100%; height:100%; top:0; left:0" title="North"></div>
            </div>
            <button class="zoomControl" @keydown.enter="() => { currentZoomPerSecond = 1 / zoomSpeed }"
                @keyup.enter="() => { currentZoomPerSecond = 1 }"
                @mousedown="() => { currentZoomPerSecond = 1 / zoomSpeed }"
                @mouseup="() => { currentZoomPerSecond = 1 }" @pointerleave="() => { currentZoomPerSecond = 1 }"
                @touchstart="() => { currentZoomPerSecond = 1 / zoomSpeed }"
                @touchend="() => { currentZoomPerSecond = 1 }">
                +
            </button>
            <button class="zoomControl" @keydown.enter="() => { currentZoomPerSecond = zoomSpeed }"
                @keyup.enter="() => { currentZoomPerSecond = 1 }"
                @mousedown="() => { currentZoomPerSecond = zoomSpeed }" @mouseup="() => { currentZoomPerSecond = 1 }"
                @pointerleave="() => { currentZoomPerSecond = 1 }"
                @touchstart="() => { currentZoomPerSecond = zoomSpeed }" @touchend="() => { currentZoomPerSecond = 1 }">
                -
            </button>

        </div>


        <!-- status overlay -->
        <div id="status" data-v-walkthrough="status">

            <div style="display:flex; flex-direction: row; align-items: center">
                <div class="time_display" v-show="!isEditingTime" @click="showTimeEntryBox"
                    @keydown.space="showTimeEntryBox" tabindex="0">
                    {{ timeText }}
                </div>
                <input v-show="isEditingTime" ref="timeEntryBox" class="timeEntryBox" @blur="hideTimeEntryBox"
                    @keydown.enter="hideTimeEntryBox" @keydown.esc="hideTimeEntryBox" @input="updateTimeFromEntryBox"
                    v-model="timeEntryValue">
                <div v-show="!isEditingTime"
                    style="display: flex; margin-left:10px; justify-content:end; flex-direction: column; align-items: stretch; padding-block: 9px">
                    <div class="subtitle">local standard time</div>
                    <div class="subtitle">(UTC {{ timeZoneText }}) {{ isDaytime ? "☀️" : "🌙" }}</div>
                </div>


            </div>

            <div class="subtitle">{{ meanSolarTimeText }} mean solar time</div>
            <div class="subtitle">{{ apparentSolarTimeText }} apparent solar time</div>
            <input type="range" min="0" max="1440" step="10" class="slider" id="time" v-model.number="localTime">

            <!-- 3 times explanation -->
            <Popper arrow placement="left" disable-click-away :show="showThreeTimesExplanation"
                @keydown.escape="() => setShowThreeTimesExplanation(false)">
                <template #content>
                    <div class="popper_content">
                        <div style="text-align: left">
                            <ThreeTimesExplanation />
                        </div>
                        <button class="v-step__button" @click="() => setShowThreeTimesExplanation(false)">Close</button>
                    </div>
                </template>
                <a class="overlay_link" href="javascript:void(0)"
                    @click="() => setShowThreeTimesExplanation(!showThreeTimesExplanation)">Why are there 3
                    times?</a>
            </Popper>

            <hr>
            <div class="subtitle" style="margin-top:13px">{{dateText}}</div>
            <input type="range" min="0" max="364" step="1" class="slider" id="day" v-model.number="day">

        </div>
    </div>





</template>


<script lang="ts">
    import { OrbitControls } from '@tresjs/cientos'
    import { onClickOutside } from '@vueuse/core'
    import interpolate from "color-interpolate";
import { computed, defineComponent, getCurrentInstance, nextTick, onMounted, reactive, ref, watch } from 'vue'
    import SunObject from './components/SunObject.vue';
    import { decimal, helpers, maxValue, minValue, required } from '@vuelidate/validators';
    import useVuelidate from '@vuelidate/core';
    import { BasicShadowMap, Vector3, Euler} from 'three';
    import { dateToString, horizontalToActualCoords, calculateSunHorizontalCoords, timeToString, timeZoneToString, longitudeToTimeZone, stringToTime } from '@/calculations';
    import DialAndGnomonSundial from './components/DialAndGnomonSundial.vue';
    import CameraHelper from './components/CameraHelper.vue';
    import RendererHelper from './components/RendererHelper.vue';
    import ThreeTimesExplanation from './components/ThreeTimesExplanation.vue';
import {  tourSteps as walkthroughSteps } from './walkthrough';
import Popper from 'vue3-popper';
import PointSundial from './components/PointSundial.vue';
import CompassObject from "./components/CompassObject.vue"
    export default defineComponent({
        name:"App",
        components: {DialAndGnomonSundial, SunObject},
    })
</script>

<style>
    #app {
        font-family: sans-serif;
        color: white;
    }
</style>

<style scoped>
    #overlay {
        position:absolute;
        width: 100%;
        height:100%;
        left:0;
        top:0;
        overflow: hidden;
        display:flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: flex-end;
        pointer-events: none;

    }

    #sidebar {
        /* flex:1;
        flex-grow: 0; */
        pointer-events:auto;
        width: 35%;
        max-width: 500px;
        min-width:150px;
        background: rgba(39, 39, 39, 0.95);
        /* position: relative; */
        /* left: 0;
        top:0; */
        height: 100%;
        /* padding-top: 20px;
        padding-left:20px;
        padding-right: 20px;
        padding-bottom: 100px; */
        
        overflow-x: hidden;
        overflow-y: scroll;
    }
    #sidebar h2 {
        /* color:white; */
        font-size: 15pt;
        background-color: brown
    }

    #sidebarContent {
        padding: 20px;
        width:100%;
        box-sizing: border-box;
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

    /* .setting label {

    } */

    .fieldTitle {
        display: block;
        margin-bottom: 3px;
        font-size: 11pt;
        white-space: nowrap
    }

    .fieldOption {
        display: inline;
        /* margin-bottom: 3px; */
        font-size: 11pt;
        /* white-space: nowrap */
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

    #status {
        pointer-events:auto;
        flex:1;
        font-family: monospace;
        padding:10px;
        text-align: left;
        color:v-bind("statusTextColor");
        max-width:400px;
        width:100%
    }

    #status hr {
        border-color: v-bind("statusTextColor");
    }

    .time_display {
        font-size: 35pt;
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
        font-size: 11pt;
    }

    .overlay_link {
        font-size: 10pt;
    }

    .sidebar_link {
        font-size: 10pt;
        color: rgb(255, 106, 52)
    }
    .sidebar_link:active {
        color: rgb(255, 160, 52)
    }

    .zoomControl {
        /* display: inline-block; */
        display:flex;
        align-items: center;
        justify-content: center;
        aspect-ratio: 1/1;
        min-height : 25px;
        background-color:brown;
        pointer-events: all;
        margin:5px;
        border-radius: 5px;
        font-family: monospace;
        font-size:15pt;
        opacity:1;
        user-select: none;
        color:white
    }
    .zoomControl:hover {
        opacity:0.5
    }


    input[type=range] {
        height: 20px;
    }

    input[type=range][orient=vertical] {
        writing-mode: vertical-lr;
        direction: rtl;
        appearance: slider-vertical;
        width: 20px;
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
        background-color: brown;
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

    #compassContainer {
        width:50px;
        height:50px;
        position:relative
    }

    #topRightControls {
        position:absolute;
        top:0;
        right:0;
        padding:10px;
        display:flex;
        align-items:center;
        flex-direction:column
    }

</style>