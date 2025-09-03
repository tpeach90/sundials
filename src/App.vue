<!-- Main file, controlling the interface and calculations. -->

<script setup lang="ts">

    import { TresCanvas } from '@tresjs/core';
    import { onClickOutside } from '@vueuse/core'
    import interpolate from "color-interpolate";
    import { computed, getCurrentInstance, nextTick, onMounted, reactive, ref, watch } from 'vue'
    import SunObject from './components/SunObject.vue';
    import { decimal, helpers, maxValue, minValue, required } from '@vuelidate/validators';
    import useVuelidate from '@vuelidate/core';
    import { BasicShadowMap, Vector3, Euler } from 'three';
    import { dateToString, clamp, horizontalToActualCoords, calculateSunHorizontalCoordsFromUTC, timeToString, timeZoneToString, longitudeToTimeZone, stringToTime, calculatePolarDayDeclination, calculateObliquityOfTheEcliptic } from '@/calculations';
    import DialAndGnomonSundial from './components/DialAndGnomonSundial.vue';
    import CameraHelper from './components/CameraHelper.vue';
    import RendererHelper from './components/RendererHelper.vue';
    import ThreeTimesExplanation from './components/ThreeTimesExplanation.vue';
    import { tourSteps as walkthroughSteps } from './walkthrough';
    import Popper from 'vue3-popper';
    import PointSundial from './components/PointSundial.vue';
    import CompassObject from "./components/CompassObject.vue"
    
    /*
     * Config
     */
    const sundialOrigin = new Vector3(0, -0.5, 0);
    const cameraTarget = sundialOrigin.clone();
    const traditionalSundialRadius = 5;
    const pointSundialRadius = 4;
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
    let sunRaysPassThroughEarth = ref(false);
    let traditionalSundialHourLineStyle = ref<"solar"|"standard">("standard");
    let pointShadowTraceHourLineStyle = ref<"modern-local"|"modern-mean-solar"|"modern-apparent-solar"|"babylonian"|"italian"|"seasonal">("modern-local");
    let sundialType = ref<"dialAndGnomon" | "pointSundial">("dialAndGnomon")
    let slant = ref<number>(0);
    let rotation = ref<number>(0);
    /**Camera position multiplier per second. <1 zoom in, >1 zoom out */
    let currentZoomPerSecond = ref<number>(1);   
    let gnomonHeight = ref<number>(1)
    let showEquinoxLine = ref<boolean>(false)
    let showJuneSolsticeLine = ref<boolean>(true);
    let showDecemberSolsticeLine = ref<boolean>(true)
    let showPolarDayLine = ref<boolean>(true);
    let showPolarNightLine = ref<boolean>(true);
    let timeAdvanceSpeed = ref<number>(0)
    let alwaysDaySkyColor = ref<boolean>(false);
    let showSundialFaceGrid = ref<boolean>(false);

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

    // make the 3 times explanation popup disappear when escape key pressed
    onMounted(() => {
        document.addEventListener("keydown", (event) => {
            if (event.key == "Escape") {
                setShowThreeTimesExplanation(false)
            }
        })
    })
   


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
    const formRules = computed<Record<keyof typeof formDefaults, object>>(() => ({
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
            minValue:minValue(-180),
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
        if (!v$.value.slant.$invalid) slant.value = Number.parseFloat(newVal) * Math.PI/180;
    }, {immediate: true})
    watch(() => formState.rotation, newVal => {
        if (!v$.value.rotation.$invalid) rotation.value = -Number.parseFloat(newVal) * Math.PI / 180;
    }, { immediate: true })
    watch(() => formState.gnomonHeight, newVal => {
        if (!v$.value.gnomonHeight.$invalid) gnomonHeight.value = Number.parseFloat(newVal);
    }, { immediate: true })


    const visibleDeclinationPlots = computed(() => {
        const plots: InstanceType<typeof PointSundial>["$props"]["declinationPlots"] = []
        if (showEquinoxLine.value) plots.push("equinox");
        if (showDecemberSolsticeLine.value) plots.push("december-solstice")
        if (showJuneSolsticeLine.value) plots.push("june-solstice")
        if (showPolarDayLine.value) plots.push("polar-day")
        if (showPolarNightLine.value) plots.push("polar-night")
        return plots
    })

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
    const threeTimesExplanationPopper = ref();
    onClickOutside(threeTimesExplanationPopper, () => setShowThreeTimesExplanation(false))

    /**
     * Set the latitude and longitude when the user clicks on the map.
     */ 
    let mapImage = ref<HTMLImageElement>();
    let mapImageIsBeingClicked = ref(false);
    function setLatLngFromMap(offsetX: number, offsetY: number) {
        if (mapImage.value) {
            const longitude = clamp(offsetX / mapImage.value.width * 360 - 180, {min:-180, max:180})
            const latitude = clamp(90 - offsetY / mapImage.value.height * 180, {min:-90, max:90});
            formState.longitude = longitude.toFixed(1);
            formState.latitude = latitude.toFixed(1);
        }
    }
    function mapImageMouseMove(e:MouseEvent) {
        if (mapImageIsBeingClicked.value) setLatLngFromMap(e.offsetX, e.offsetY)
    }
    function mapImageTouchMove(e:TouchEvent) {
        // for touchscreens
        const rect = mapImage.value?.getBoundingClientRect()
        if (!rect) return
        const touch = e.touches[0]
        setLatLngFromMap(touch.clientX - rect.left, touch.clientY - rect.top)

    }
    function mapImageStartClicking() {
        mapImageIsBeingClicked.value = true;
    }
    function mapImageClick(e:MouseEvent) {
        setLatLngFromMap(e.offsetX, e.offsetY)
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

    function timeAdvanceButtonClicked() {
        if (timeAdvanceSpeed.value == 0) {
            timeAdvanceSpeed.value = 1
        } else {
            timeAdvanceSpeed.value *= 4
            if (timeAdvanceSpeed.value > 16) {
                timeAdvanceSpeed.value = 0
            }
        }
    }
    function advanceTime(mins:number) {
        localTime.value += mins
        if (localTime.value >= 1440) {
            localTime.value %= 1440
            day.value = (day.value + 1) % 365
        }
    }

    /**
     * computed values
     */
    const sundialRotation = computed(() => new Euler(Math.abs(slant.value), rotation.value + (slant.value < 0 ? Math.PI : 0), 0, "YXZ"));
    /** relative to sundial origin and rotation */
    const gnomonRelativePosition = computed(() => new Vector3(0, gnomonHeight.value, 0));
    const nodusRelativePosition = computed(() => new Vector3(0, gnomonHeight.value, 0));
    /** convert local time to UTC +0 */
    const time = computed(() => (((localTime.value - timeZone.value) % 1440) + 1440) % 1440)
    const sunHorizontalCoords = computed(() => calculateSunHorizontalCoordsFromUTC(day.value, time.value, latitude.value, longitude.value));
    const sunCoords = computed(() => horizontalToActualCoords(sunHorizontalCoords.value.azimuth, sunHorizontalCoords.value.altitude))
    // let gnomonRotation = computed(() => (90-latitude.value)*Math.PI/180);
    const isDaytime = computed(() => sunHorizontalCoords.value.altitude >= 0);
    const statusTextColor = computed(() => isDaytime.value || alwaysDaySkyColor.value ? "black" : "white")
    const timeText = computed(() => timeToString(localTime.value))
    const dateText = computed(() => dateToString(day.value));
    // mst is within 1 second of UTC at 0° longitude so this is fine
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
        // stays at the same value until close to sunset (reasoning is that people's eyes adjust during the daytime)
        if (sunHorizontalCoords.value.altitude > 0.1) return 1;
        if (sunHorizontalCoords.value.altitude > 0) return sunHorizontalCoords.value.altitude/0.1;
        return 0;
    })
    const skyColor = computed(() => {
        if (alwaysDaySkyColor.value) {
            return "#87CEEB"
        }
        // 1: day, 0: night.
        let skyColorBrightness = 0
        if (sunHorizontalCoords.value.altitude > 0.1) skyColorBrightness = 1;
        else if (sunHorizontalCoords.value.altitude > -0.1) skyColorBrightness = (sunHorizontalCoords.value.altitude+0.1) / 0.2;
        // make the sky look nice innit
        return interpolate(["#02407a", "#87CEEB"])(skyColorBrightness);
    })
    /** brightness of sunlight on the sundial face, [0,1] */
    const sunlightSundialFaceIntensity = computed(() => {
        const sundialNormal = new Vector3(0, 1, 0).applyEuler(sundialRotation.value)
        const sunVector = new Vector3(sunCoords.value.x, sunCoords.value.y, sunCoords.value.z)
        // dot product: a.b = |a||b|cosθ.
        // cosθ is the intensity
        const intensity = sundialNormal.dot(sunVector) / (sundialNormal.length() * sunVector.length())
        if (intensity <= 0) return 0
        else return intensity * sunlightIntensity.value
    })
    const gridColorPalette = computed(() => sunlightSundialFaceIntensity.value >= 0.5 ? "light" : "dark")
    const compassRotation = computed(() => {

        if (!cameraPosition.value) {
            return new Euler()
        }

        const cameraDistance = cameraPosition.value.distanceTo(new Vector3(0,0,0))
        const altitude = Math.asin(cameraPosition.value.y/cameraDistance);
        const azimouth = Math.atan2(cameraPosition.value.z, cameraPosition.value.x)
        return new Euler(altitude - Math.PI / 2, azimouth - Math.PI/2, 0, 'XYZ')
    })

    const timeAdvanceButtonText = computed(() => {
        if (timeAdvanceSpeed.value == 0) {
            return "▶"
        } else {
            return timeAdvanceSpeed.value + "x"
        }
    })


    const polarDayDeclination = computed(() => {
        const decl = calculatePolarDayDeclination(latitude.value);
        if (Math.abs(decl) * Math.PI/180 > calculateObliquityOfTheEcliptic(8400.5 + 132 /*2023*/)) {
            return null
        } else {
            return decl
        }
    })
    const polarDayDeclinationText = computed(() => polarDayDeclination.value ? polarDayDeclination.value.toFixed(1) + "°" : "n/a")
    const polarNightDeclinationText = computed(() => polarDayDeclination.value ? (-polarDayDeclination.value).toFixed(1) + "°" : "n/a")

    // previously all this stuff was inlined in the template
    // move all inline processing stuff in the <Tres...> tag props here because this is necessary to make tresjs render frames on demand
    // I have done this with most of the 3d components as well
    const showDialAndGnomonSundial = computed(() => sundialType.value === "dialAndGnomon")
    const showPointSundial = computed(() => sundialType.value === "pointSundial")
    const sunCoordsArray = computed<[number, number, number]>(() => [sunCoords.value.x, sunCoords.value.y, sunCoords.value.z])
    const directionalLightIntensity = computed(() => sunRaysPassThroughEarth.value ? 1 : sunlightIntensity.value)
    const cameraXOffset = computed(() => -(sidebarDims.value.clientWidth)/2)
    const gridHelperArgs = [50, 50, '#AAAAAA', '#AAAAAA'] as const
    const gridHelperPosition = [0, -8, 0] as const
    const compassCameraPosition = [0, 10, 0] as const
    const compassCameraLookAt = [0, 0, 0] as const

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
                :radius="traditionalSundialRadius" :hourLineStyle="traditionalSundialHourLineStyle"
                :time-zone="timeZone" :numeralDistanceFromSundialOrigin="numeralDistanceFromSundialOrigin"
                :showGrid="showSundialFaceGrid" :gridColorPalette="gridColorPalette" />

            <PointSundial :show="showPointSundial" :latitude="latitude" :longitude="longitude" :origin="sundialOrigin"
                :rotation="sundialRotation" :gnomon-position="nodusRelativePosition" :radius="pointSundialRadius"
                :hourLineStyle="pointShadowTraceHourLineStyle" :time-zone="timeZone"
                :show-equinox-line="showEquinoxLine" :declinationPlots="visibleDeclinationPlots" :localTime="localTime"
                :day="day" :showGrid="showSundialFaceGrid" :gridColorPalette="gridColorPalette" />

            <SunObject :position="sunCoords" />

            <!-- directional light points at :target="[0,0,0]" by default -->
            <TresDirectionalLight :position="sunCoordsArray" :intensity="directionalLightIntensity"
                :shadow-mapSize-width="2048" :shadow-mapSize-height="2048" cast-shadow />
            <TresAmbientLight color="#AAAAAA" />
            <TresGridHelper :args="gridHelperArgs" :position="gridHelperPosition" />
            <CameraHelper :x-offset="cameraXOffset" :zoom-per-second="currentZoomPerSecond"
                @cameraPosChange="pos => cameraPosition = pos" @on-advance-time="advanceTime"
                :time-advance-speed="timeAdvanceSpeed" :target="cameraTarget" />
            <RendererHelper />
        </TresCanvas>
    </div>

    <div id="overlay">

        <div id="sidebar" ref="sidebar">
            <div id="sidebarContent">

                <a class="sidebar_link" @click="e => {e.preventDefault(); toggleWalkthrough()}"
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
                            style="grid-row: 1; grid-column: 1; margin-right:10px; height:100%; margin-top: 0px; margin-bottom:0px; touch-action: none"
                            type="range" min="-90" max="90" step="-0.1" class="slider" orient="vertical"
                            v-model="v$.latitude.$model">
                        <!-- <div id="coordBox" style="grid-row: 1; grid-column: 2;"></div> -->
                        <div style="position:relative; aspect-ratio: 2 / 1;">
                            <img src="./assets/world-map-coordinates-correct.png" id="mapImage"
                                alt="An outline world map, on which the user can click to set the latitude and longitude."
                                style="grid-row: 1; grid-column: 2; object-fit: contain; display:block; margin:0px; touch-action: none;"
                                draggable="false" @mousemove="mapImageMouseMove" @mousedown="mapImageStartClicking"
                                @touchstart="mapImageStartClicking" @touchmove="mapImageTouchMove"
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
                        <input type="range" :min="-180" :max="180" step="1" class="slider" v-model="v$.slant.$model">
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

                    <!-- traditional sundial hour lines -->
                    <div v-if="sundialType == 'dialAndGnomon'">
                        <div class="checkboxSetting">
                            <input type="radio" id="standardLines" value="standard"
                                v-model="traditionalSundialHourLineStyle">
                            <label for="standardLines" class="fieldOption">Adjusted for time zone and longitude</label>
                        </div>
                        <div class="checkboxSetting">
                            <input type="radio" id="solarLines" value="solar" v-model="traditionalSundialHourLineStyle">
                            <label for="solarLines" class="fieldOption">Apparent solar time</label>
                        </div>
                    </div>

                    <!-- point shadow trace hour line selector-->
                    <div v-else-if="sundialType=='pointSundial'" style="margin-left:10px">
                        <label class="fieldTitle">Modern hours</label>
                        <div class="checkboxSetting">
                            <input type="radio" id="pstModernLocal" value="modern-local"
                                v-model="pointShadowTraceHourLineStyle">
                            <label for="pstModernLocal" class="fieldOption">Local standard time</label>
                        </div>
                        <div class="checkboxSetting">
                            <input type="radio" id="pstModernMeanSolar" value="modern-mean-solar"
                                v-model="pointShadowTraceHourLineStyle">
                            <label for="pstModernMeanSolar" class="fieldOption">Mean solar time</label>
                        </div>
                        <div class="checkboxSetting">
                            <input type="radio" id="pstModernApparentSolar" value="modern-apparent-solar"
                                v-model="pointShadowTraceHourLineStyle">
                            <label for="pstModernApparentSolar" class="fieldOption">Apparent solar time</label>
                        </div>
                        <label class="fieldTitle" style="margin-top:4px">
                            Other
                            <a class="sidebar_link" href="https://www.bcgnomonics.com/types-of-hours"
                                title="Explanation on bcgnomonics.com" target="_blank">(?)</a>
                        </label>
                        <div class="checkboxSetting">
                            <input type="radio" id="pstBabylonian" value="babylonian"
                                v-model="pointShadowTraceHourLineStyle">
                            <label for="pstBabylonian" class="fieldOption">Babylonian hours – hours from
                                sunrise</label>
                        </div>
                        <div class="checkboxSetting">
                            <input type="radio" id="pstItalian" value="italian" v-model="pointShadowTraceHourLineStyle">
                            <label for="pstItalian" class="fieldOption">Italian hours – hours from sunset</label>
                        </div>
                        <div class="checkboxSetting">
                            <input type="radio" id="pstSeasonal" value="seasonal"
                                v-model="pointShadowTraceHourLineStyle">
                            <label for="pstSeasonal" class="fieldOption">Seasonal/unequal hours – sunrise to
                                sunset</label>
                        </div>
                    </div>

                </div>

                <!-- declination lines -->
                <div v-if="sundialType == 'pointSundial'">
                    <br>
                    <div class="setting">
                        <label class="fieldTitle">Constant-declination curves</label>
                        <div class="checkboxSetting">
                            <input type="checkbox" id="showJuneSolsticeLine" v-model="showJuneSolsticeLine"
                                style="margin-right: 10px; display: inline;">
                            <label for="showJuneSolsticeLine" class="fieldOption">June solstice (23.44°)</label>
                        </div>
                        <div class="checkboxSetting">
                            <input type="checkbox" id="showDecemberSolsticeLine" v-model="showDecemberSolsticeLine"
                                style="margin-right: 10px; display: inline;">
                            <label for="showDecemberSolsticeLine" class="fieldOption">December solstice
                                (-23.44°)</label>
                        </div>
                        <div class="checkboxSetting">
                            <input type="checkbox" id="showEquinoxLine" v-model="showEquinoxLine"
                                style="margin-right: 10px; display: inline;">
                            <label for="showEquinoxLine" class="fieldOption">Equinox (0°)</label>
                        </div>
                        <div class="checkboxSetting">
                            <input type="checkbox" id="showPolarDayLine" v-model="showPolarDayLine"
                                style="margin-right: 10px; display: inline;">
                            <label for="showPolarDayLine" class="fieldOption">Polar day boundary (<div
                                    class="variable-readout">{{ polarDayDeclinationText }}</div>)</label>
                        </div>
                        <div class="checkboxSetting">
                            <input type="checkbox" id="showPolarNightLine" v-model="showPolarNightLine"
                                style="margin-right: 10px; display: inline;">
                            <label for="showPolarNightLine" class="fieldOption">Polar night boundary (<div
                                    class="variable-readout">{{ polarNightDeclinationText }}</div>)</label>
                        </div>
                    </div>
                </div>



                <br>
                <h2>Misc</h2>
                <div class="checkboxSetting">
                    <input type="checkbox" id="showSundialFaceGrid" v-model="showSundialFaceGrid">
                    <label for="showSundialFaceGrid" class="fieldOption">Sundial grid overlay</label>
                </div>
                <div class="checkboxSetting">
                    <input type="checkbox" id="sunRaysPassThroughEarth" v-model="sunRaysPassThroughEarth">
                    <label for="sunRaysPassThroughEarth" class="fieldOption">Light can reach the sundial at
                        night</label>
                </div>
                <div class="checkboxSetting">
                    <input type="checkbox" id="alwaysDaySkyColor" v-model="alwaysDaySkyColor">
                    <label for="alwaysDaySkyColor" class="fieldOption">Disable night-time dark sky color</label>
                </div>
                <br>

                <footer>
                    <p id="copyrightText">© Thomas Peach 2025. <a class="sidebar_link"
                            href="mailto:thomas.peach546@gmail.com">Contact</a></p>
                </footer>
            </div>

        </div>

        <!-- top right controls -->
        <div id="topRightControls">
            <div id="compassContainer" title="Compass">
                <TresCanvas render-mode="on-demand">
                    <TresAmbientLight color="#FFFFFF" :intensity="2" />
                    <TresOrthographicCamera :position="compassCameraPosition" :lookAt="compassCameraLookAt"
                        :zoom="15" />
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
            <div style="display:flex; flex-direction:row">
                <input type="range" min="0" max="1440" step="10" class="slider" id="time" v-model.number="localTime">
                <button type="button" @click="timeAdvanceButtonClicked" id="time_advance_button"
                    title="Auto-advance time">{{timeAdvanceButtonText}}</button>
            </div>

            <!-- 3 times explanation -->
            <Popper arrow placement="left" :show="showThreeTimesExplanation" ref="threeTimesExplanationPopper">
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
        pointer-events:auto;
        width: 35%;
        max-width: 500px;
        min-width:150px;
        background: rgba(39, 39, 39, 0.95);
        height: 100%;       
        overflow-x: hidden;
        overflow-y: scroll;
    }
    #sidebar h2 {
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

    .fieldTitle {
        display: block;
        margin-bottom: 3px;
        font-size: 11pt;
        white-space: nowrap
    }

    .fieldOption {
        display: inline;
        font-size: 11pt;
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
        margin-bottom: 3px;
        font-size: 11pt;
        display: inline
    }

    .checkboxSetting input {
        margin-right: 10px;
        display: inline;
    }

    .small_input {
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

    #copyrightText {
        font-size: 10pt
    }

    input{
        accent-color: rgb(201, 84, 42)
    }

    .variable-readout {
        color: rgb(235, 164, 83);
        display:inline
    }




</style>