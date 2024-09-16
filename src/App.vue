<!-- Main file, controlling the interface and calculations. -->

<script setup lang="ts">

    import { TresCanvas } from '@tresjs/core';
    
    /*
     * Config
     */
    const sundialOrigin = new Vector3(0, -0.5, 0);
    /** relative to sundial origin and rotation */
    const gnomonRelativePosition = ref<number[]>([0,1,0]);
    /** euler angle */
    const sundialRadius = 5;
    const numeralDistanceFromSundialOrigin = 4;

    let sundialRotation = ref<Euler>(new Euler(0,0,0, "YXZ"));
    let sundialNormal = computed(() => new Vector3(0, 1, 0).applyEuler(sundialRotation.value));

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

            nextTick(() => timeEntryBox.value?.focus());
            
        }
    }
    function hideTimeEntryBox() {
        if (isEditingTime.value == true) {
            isEditingTime.value = false
            
            if (!timeEntryBox.value) return;

            const newTime = stringToTime(timeEntryBox.value.value);
            if (isNaN(newTime)) return;

            localTime.value = newTime;
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
        // a very unscientific way of calculating the apparent sunlight intensity.
        // have a little bit of sunlight when the sun is below the horizon.
        if (sunHorizontalCoords.value.altitude > 0.1) return 1;
        if (sunHorizontalCoords.value.altitude > -0.1) return (sunHorizontalCoords.value.altitude + 0.1)/0.2;
        return 0;
    })
    let skyColor = computed(() => {
        // make the sky look nice innit
        return interpolate(["#02407a", "#87CEEB"])(sunlightIntensity.value);
    })
    let gnomonAbsolutePosition = computed(() => {
        return new Vector3(...gnomonRelativePosition.value)
            .applyEuler(sundialRotation.value)
            .add(new Vector3(...sundialOrigin))
    })
    /** if there is an interection return it, and whether the intersection is in the positive direction of the gnomon vector.*/
    let stylePlateIntersection = computed(() => {
        // intersect the plane of the plate with the line of the sundial gnomon.
        const plane = new Plane(sundialNormal.value, 0).translate(new Vector3(...sundialOrigin));
        const rayDir = new Vector3(0, -(Math.sin(latitude.value * Math.PI / 180)), (Math.cos(latitude.value * Math.PI / 180)));
        return infiniteLineIntersectWithPlaneWithDir(plane, gnomonAbsolutePosition.value, rayDir);
    })
    let stylePlateIntersectionPoint = computed(() => stylePlateIntersection.value?.point ?? null);
    /** If the intersection with the plate lies on the line between the center of the gnomon and celestial north, then this value is -1. If south, then 1.*/
    let stylePlateIntersectionPointOrder = computed(() => stylePlateIntersection.value?.dir ?? null)

    // /** If the gnomon is parallel to the plate, this currently messes up the calculations. So just change the coordinates a tiny bit. VERY BAD AND LAZY CODE, @todo make not bad*/
    // watch(stylePlateIntersectionPoint, value => {
    //     if (!value) {
    //         latitude.value += 0.00001 * (Math.random()+0.5) * (latitude.value > 0 ? -1: 1)
    //         longitude.value += 0.00001 * (Math.random()+0.5) * (longitude.value > 0 ? -1: 1)
    //     }
    // }, {immediate: true})

    
    const hourLineHours = [...Array(24).keys()];

    // The hours expressed in the range midnight to midnight, 0 to 2π
    const hourLineTimeAngles = computed(() => hourLineHours.map(i => {
        let offsetHour;
        if (hourLineStyle.value == 'standard') {
            // need to adjust for time zones
            offsetHour = i - timeZone.value / 60 + longitude.value * 24 / 360
        }
        else {
            offsetHour = i;
        }
        return ((((offsetHour * 60) % 1440) + 1440) % 1440) * Math.PI * 2 / 1440
    }))

    // direction vector of each hour line on the sundial
    const hourLineDirections = computed(() => hourLineTimeAngles.value.map(timeAngle => {
        return calculateShadowDirection(
            timeAngle,
            latitude.value * Math.PI / 180,
            new Vector3(...sundialNormal.value)
        ).multiplyScalar((stylePlateIntersectionPointOrder.value ?? 1))
        // the scalar multiple is to fix a bug with the numerals being offset by 12 hours in some cases.
    }));

    /** If the style plate intersection point is really far away from the sundial origin, or doesn't exist, then we need to calculate the hour lines differently. */
    const hourLinesCalculationMethod = computed(() => {
        if (stylePlateIntersectionPoint.value && stylePlateIntersectionPoint.value.distanceTo(sundialOrigin) < 1000) {
            return "stylePlateIntersection"
        } else {
            return "otherIntersection"
        }
    })

    // the point used, in addition to the direction vector, to fully define the hour line.
    const hourLinePoints = computed(() => {
        switch (hourLinesCalculationMethod.value) {
            case 'stylePlateIntersection':
                return hourLineHours.map(() => stylePlateIntersectionPoint.value as Vector3)
            case 'otherIntersection': {

                /**
                 * Instead of using the stylePlateIntersectionPoint for every line, use a different point for each line.
                 * This point is at the intersection of 3 planes:
                 * 1. The plane containing the mean sun position and style
                 * 2. The surface of the sundial onto which the gnomon's shadow strikes (top surface)
                 * 3. A plane that is perpendicular to the direction of the style, and which does not intersect with the 3d sundial object
                 * */ 
                const latRad = latitude.value * Math.PI / 180;
                const gnomon1 = gnomonAbsolutePosition.value;
                const gnomonDir = new Vector3(0, Math.sin(latRad), -Math.cos(latRad))
                const gnomon2 = gnomonDir.clone().add(gnomon1);
                // a point 1 unit off the side of the sundial plate
                const pointOutsidePlate = gnomonDir.clone()
                    .projectOnPlane(sundialNormal.value)
                    .normalize()
                    .multiplyScalar((sundialRadius + 1) * -(stylePlateIntersectionPointOrder.value ?? 1))
                    .add(sundialOrigin);

                const p2 = new Plane().setFromNormalAndCoplanarPoint(sundialNormal.value, sundialOrigin);
                const p3 = new Plane().setFromNormalAndCoplanarPoint(gnomonDir, pointOutsidePlate);

                return hourLineTimeAngles.value.map((timeAngle) => {

                    const sunPos = sunPosAtEquinox(timeAngle, latRad)
                    const p1 = new Plane().setFromCoplanarPoints(sunPos.clone().add(gnomon1), gnomon1, gnomon2);
                    const point = vertIntersectPlanes(p1, p2, p3) ?? pointOutsidePlate;
                    return point;
                })
            }
            default:
                // this should never happen.
                return [];



        }
        
    })



    // lambdas of the formula plateStyleIntersectionPoint + lambda * shadowDir such that it intersects the edge of the sundial plate.
    let hourLineSundialSphereIntersectionParameters = computed(() => {

        return hourLineHours.map((hour, i) => {
            const point = hourLinePoints.value[i];
            const dir = hourLineDirections.value[i];
            // to get the portion of the line we want, intersect the hour line with a sphere centered on the sundial plate origin.
            const lambdas = infiniteLineIntersectWithSphereParameters(new Vector3(...sundialOrigin), sundialRadius, point, dir);
            if (lambdas.length == 0) return [];
            // lambda = 0 is the plate/style intersection point. Negative values are on the wrong side.
            if (lambdas[0] < 0 && lambdas[1] < 0) return [];
            // only display positive values
            if (lambdas[0] < 0) lambdas[0] = 0;
            // we know that lambdas[1] > 0.
            return lambdas
        })

    })

    // vector to raise the sundial lines a bit off the plate
    let plateToHourLineHeight = computed(() => sundialNormal.value.clone().normalize().multiplyScalar(0.007));

    let hourLines = computed(() => hourLineHours.map((hour, i) => {
        const linePoint = hourLinePoints.value[i];
        const lineDir = hourLineDirections.value[i];
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
                lineDir.clone().multiplyScalar(lambdas[0]).add(linePoint).add(plateToHourLineHeight.value),
                lineDir.clone().multiplyScalar(lambdas[1]).add(linePoint).add(plateToHourLineHeight.value),
            ],
            labelPoint: (() => {
                // where the label should be displayed.
                // Intersect the hour line with a sphere of radius smaller than the sundial radius, centered on the sundial origin
                const labelSphereIntersectLambdas = infiniteLineIntersectWithSphereParameters(new Vector3(...sundialOrigin), numeralDistanceFromSundialOrigin, linePoint, lineDir);
                if (labelSphereIntersectLambdas.length == 0) return null;
                if (labelSphereIntersectLambdas[1] < 0) return null;
                const labelPoint = lineDir.clone().multiplyScalar(labelSphereIntersectLambdas[1]).add(linePoint);
                // prevent numbers from getting too bunched up
                if (hourLinesCalculationMethod.value == "stylePlateIntersection" && linePoint.distanceTo(labelPoint) < 3) return null;
                // move to relative coordinate of sundial
                labelPoint.sub(sundialOrigin).applyMatrix4(new Matrix4().makeRotationFromEuler(sundialRotation.value).invert())
                return labelPoint.toArray();
            })()
        }
    }));



   

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
        <TresCanvas :clear-color="skyColor" shadows :shadowMapType="BasicShadowMap">
            <TresPerspectiveCamera />
            <SundialObject :latitude="latitude" :origin="sundialOrigin" :rotation="sundialRotation"
                :gnomon-position="gnomonRelativePosition" :hour-labels="hourLines" :radius="sundialRadius" />
            <SunObject :position="[sunCoords.x, sunCoords.y, sunCoords.z]" />
            <template v-for="hourLine in hourLines" v-bind:key="hourLine.hour">
                <Line2 :line-width="1" :points="hourLine.points ?? [[0,0,0], [0,0,0]]" color="#FFFFFF" />
            </template>

            <!-- directional light points at :target="[0,0,0]" by default -->
            <TresDirectionalLight :position="[sunCoords.x, sunCoords.y, sunCoords.z]"
                :intensity="sunRaysPassThroughEarth ? 1 : sunlightIntensity" :shadow-mapSize-width="2048"
                :shadow-mapSize-height="2048" cast-shadow />
            <TresAmbientLight color="#AAAAAA" />
            <OrbitControls :enable-damping="false" :rotate-speed="0.5" :enable-pan="false" :target="[0,0,0]" />
            <TresGridHelper :args="[50, 50, '#AAAAAA', '#AAAAAA']" :position="[0, -8, 0]" />
            <CameraOffsetHelper :x-offset="-(sidebarDims.clientWidth)/2" />
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
                </div>
                <div class="setting" data-v-walkthrough="hour-lines">
                    <label class="fieldTitle">Hour lines</label>
                    <div class="checkboxSetting">
                        <input type="radio" id="solarLines" value="solar" v-model="hourLineStyle">
                        <label for="solarLines" class="fieldOption">Solar time</label>
                    </div>
                    <div class="checkboxSetting">
                        <input type="radio" id="standardLines" value="standard" v-model="hourLineStyle">
                        <label for="standardLines" class="fieldOption">Adjusted for time zone</label>
                    </div>
                </div>

                <br>
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
                </div>

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



        <!-- status overlay -->
        <div class="status" data-v-walkthrough="status">

            <div style="display:flex; flex-direction: row; align-items: center">
                <div class="time_display" v-show="!isEditingTime" @click="showTimeEntryBox"
                    @keydown.space="showTimeEntryBox" tabindex="0">
                    {{ timeText }}
                </div>
                <input v-show="isEditingTime" ref="timeEntryBox" class="timeEntryBox" @blur="hideTimeEntryBox"
                    @keydown.enter="hideTimeEntryBox" v-model="timeEntryValue">
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
                    @click="() => setShowThreeTimesExplanation(!showThreeTimesExplanation)">Why are there 3 times?</a>
            </Popper>

            <hr>
            <div class="subtitle" style="margin-top:13px">{{dateText}}</div>
            <input type="range" min="0" max="364" step="1" class="slider" id="day" v-model.number="day">

        </div>
    </div>



</template>


<script lang="ts">
    import { Line2, OrbitControls } from '@tresjs/cientos'
    import { onClickOutside } from '@vueuse/core'
    import interpolate from "color-interpolate";
import { computed, defineComponent, getCurrentInstance, nextTick, onMounted, reactive, ref, watch } from 'vue'
    import SunObject from './components/SunObject.vue';
    import { decimal, helpers, maxValue, minValue, required } from '@vuelidate/validators';
    import useVuelidate from '@vuelidate/core';
    import { BasicShadowMap, Vector3, Plane, Euler, Matrix4,} from 'three';
    import { dateToString, calculateShadowDirection, horizontalToActualCoords, calculateSunHorizontalCoords, timeToString, timeZoneToString, infiniteLineIntersectWithSphereParameters, infiniteLineIntersectWithPlaneWithDir, longitudeToTimeZone, stringToTime, vertIntersectPlanes, sunPosAtEquinox } from '@/calculations';
    import SundialObject from './components/SundialObject.vue';
    import CameraOffsetHelper from './components/CameraOffsetHelper.vue';
    import RendererHelper from './components/RendererHelper.vue';
    import ThreeTimesExplanation from './components/ThreeTimesExplanation.vue';
import {  tourSteps as walkthroughSteps } from './walkthrough';
import Popper from 'vue3-popper';
    export default defineComponent({
        name:"App",
        components: {SundialObject, SunObject},
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


    .status {
        /* position: absolute; */
        /* bottom:0;
        right:0; */
        pointer-events:auto;
        flex:1;
        font-family: monospace;
        /* margin-right: 20px;
        margin-bottom: 20px; */
        margin:10px;
        text-align: left;
        color:v-bind("statusTextColor");
        max-width:400px;
        width:100%
    }

    .status hr {
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
</style>