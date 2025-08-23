<!-- 3D object of the sundial -->

<script setup lang="ts">

import { PropType, computed, defineProps, ref, watch } from 'vue'
import { Euler, Matrix4, Plane, Ray, Vector3 } from 'three';
import Line2Clipped from './Line2FromCientosPackageAndItsTheSameButYouCanAlsoUseClippingPlanesSoItsNot.vue';
import { Line2 } from "@tresjs/cientos";
import { calculateObliquityOfTheEcliptic, calculateShadowDirection, calculateSunHorizontalCoordsFromApparentSolarTime, calculateSunHorizontalCoordsFromBabylonianTime, calculateSunHorizontalCoordsFromUTC, extractCloseAndPadSequence, horizontalToActualCoords, rad, toHorizontalCoords, assertUnreachable, calculateSunHorizontalCoordsFromItalianTime, calculateSunHorizontalCoordsFromSeasonalTime } from '@/calculations';
import SundialLetter from './SundialLetter.vue';

const props = defineProps(
    {
        show: {
            required: true,
            type: Boolean as PropType<boolean>
        },
        latitude: {
            required: true,
            type: Number as PropType<number>
        },
        longitude: {
            required: true,
            type: Number as PropType<number>
        },
        radius: {
            required: true,
            type: Number as PropType<number>
        },
        gnomonPosition: {
            required: true,
            type: Object as PropType<Vector3>
        },
        origin: {
            required: true,
            type: Object as PropType<Vector3>
        },
        rotation: {
            required: true,
            type: Object as PropType<Euler>
        },
        hourLineStyle: {
            required: true,
            type: String as PropType<"modern-local" | "modern-mean-solar" | "modern-apparent-solar" | "babylonian" | "italian" | "seasonal">
        },
        timeZone: {
            required: true,
            type: Number as PropType<number>
        },
        showEquinoxLine: {
            required: true,
            type: Boolean as PropType<boolean>
        }

    })


    // copy props only when visible, then do calculations on the copied props.
    const freezeProps = ref({ ...props })
    watch(props, (newValue) => {
        if (newValue.show) {
            freezeProps.value = { ...newValue }
        }
    }, { immediate: true })


    const gnomonAbsolutePosition = computed(() => {
        return new Vector3(...freezeProps.value.gnomonPosition)
            .applyEuler(freezeProps.value.rotation)
            .add(new Vector3(...freezeProps.value.origin))
    })
    let sundialNormal = computed(() => new Vector3(0, 1, 0).applyEuler(freezeProps.value.rotation));


    const platePlane = computed(() => new Plane(sundialNormal.value, 0).translate(new Vector3(...freezeProps.value.origin)))
    // vector used to raise the plot above the surface.
    const plateToPlotVector = computed(() => sundialNormal.value.clone().normalize().multiplyScalar(0.007))


    /**
     * Affected by context: latitude, longitude, platePlane.
     * Coordinates produced are raised slightly above the plate with plateToPlotVector
     * @param hour 0 to 23 (hours from midnight. To `timeStandard` standard.)
     * @param day 0 to 364
     * @param timeStandard mean solar time or utc+0 time.
     */
    function projectionOnPlate(hour: number, day: number, hourLineStyle: typeof props.hourLineStyle) : Vector3 | null {

        let horizontalCoords: { azimuth:number, altitude: number }

        switch (hourLineStyle) {
            case 'modern-local':
                /**@todo move adjustment for time zone to here (currently in the labels code somewhere) */
                horizontalCoords = calculateSunHorizontalCoordsFromUTC(day, hour * 60 - freezeProps.value.timeZone, freezeProps.value.latitude, freezeProps.value.longitude)
                break
            case 'modern-mean-solar':
                // mean solar time is equivalent to standard time at longitude=0
                horizontalCoords = calculateSunHorizontalCoordsFromUTC(day, hour * 60, freezeProps.value.latitude, 0)
                break
            case 'modern-apparent-solar':
                horizontalCoords = calculateSunHorizontalCoordsFromApparentSolarTime(day, hour * 60, freezeProps.value.latitude, freezeProps.value.longitude)
                break
            case 'babylonian': {
                const hc = calculateSunHorizontalCoordsFromBabylonianTime(day, hour * 60, freezeProps.value.latitude, freezeProps.value.longitude, { maxDeclination: Math.max(polarDayDeclination.value, polarNightDeclination.value), minDeclination: Math.min(polarDayDeclination.value, polarNightDeclination.value)})
                if (!hc) return null
                else horizontalCoords = hc
                break
            }
            case 'italian': {
                const hc = calculateSunHorizontalCoordsFromItalianTime(day, hour * 60, freezeProps.value.latitude, freezeProps.value.longitude, { maxDeclination: Math.max(polarDayDeclination.value, polarNightDeclination.value), minDeclination: Math.min(polarDayDeclination.value, polarNightDeclination.value) })
                if (!hc) return null
                else horizontalCoords = hc
                break
            }
            case 'seasonal':{
                const hc = calculateSunHorizontalCoordsFromSeasonalTime(day, hour * 60, freezeProps.value.latitude, freezeProps.value.longitude, { maxDeclination: Math.max(polarDayDeclination.value, polarNightDeclination.value), minDeclination: Math.min(polarDayDeclination.value, polarNightDeclination.value) })
                if (!hc) return null
                else horizontalCoords = hc
                break
            }
        }

        // sun pos


        const sunPos = horizontalToActualCoords(horizontalCoords.azimuth, horizontalCoords.altitude)

        // shadow projection on plate
        const ray = new Ray(gnomonAbsolutePosition.value, new Vector3(-sunPos.x, -sunPos.y, -sunPos.z))
        const intersection = ray.intersectPlane(platePlane.value, new Vector3())

        return intersection?.add(plateToPlotVector.value) ?? null
    }


    const hourLinePlotRangeType = computed(() => ["modern-local", "modern-mean-solar"].includes(freezeProps.value.hourLineStyle) ? "full-year" : "half-year")
    const hourLinePlotHours = [...Array(24).keys()];
    const hourLinePlotDays = computed(() => {
        if (hourLinePlotRangeType.value == "full-year") {
            return [...Array(37).keys()].map(x => 10*x)
        } else {
            // only use half the year, between the 2 solstices
            return [...Array(37).keys()].map(x => 171 + Math.round((x/36)*(354-171)))
        }
    })
    /**[hour][day] -> projection point. */
    const hourLinePlotPoints = computed(() => 
        hourLinePlotHours.map(hour => 
            hourLinePlotDays.value.map(day => 
                projectionOnPlate(hour, day, freezeProps.value.hourLineStyle)
            )
        )
    )

    // remove nulls from points, make lines closed, pad with repeated last element, label each line with the hour
    const hourLinePlotLines = computed(() => 
        [...hourLinePlotPoints.value.entries()].map(([i, points]) => 
            ({
                hour: hourLinePlotHours[i],
                line: (() => {
                    const _line = extractCloseAndPadSequence(points, hourLinePlotDays.value.length + 1, new Vector3(0, 0, 0), /*dont close*/hourLinePlotRangeType.value == "half-year")

                    // // all this stuff is trying to find non-linear sections of the line because I was having problems
                    // let delta = new Vector3().subVectors(_line[1], _line[0])
                    // for (let j = 1; j < _line.length - 1; j++) {
                    //     let newDelta = new Vector3().subVectors(_line[j+1], _line[j])
                    //     if (delta.length() > 0.01 && newDelta.length() > 0.01) {
                    //         // check they are pointing in the same direction
                    //         const deltaUnit = delta.clone().normalize()
                    //         const newDeltaUnit = newDelta.clone().normalize()
                    //         if (deltaUnit.distanceTo(newDeltaUnit) > 0.01) {
                    //             console.log("what")
                    //         }
                    //     }
                    //     delta = newDelta
                    // }
                    return _line
                })(),
                show: !(freezeProps.value.hourLineStyle == "seasonal" && i > 12)
            })
        )
    )


    
    
    // declination plots - plotting the path of the shadow throughout a day at a specific declination
    type DeclinationPlotLabel = "december-solstice" | "june-solstice" | "equinox" | "polar-day" | "polar-night"
    const declinationPlotHours = [...Array(48).keys()].map(x => x/2)
    const obliquityOfTheEcliptic2023 = calculateObliquityOfTheEcliptic(8400.5 + 132)
    // Note. commented out 0.833's were to adjust for the sun diameter and atmonspheric refraction,
    // but the latter is so variable dependent on temp, pressure, etc that it doesn't really make sense to adjust for this
    const showPolarDayAndNight = computed(() => Math.abs(freezeProps.value.latitude) > 90 - obliquityOfTheEcliptic2023 * 180 / Math.PI /*+/- 0.833*/)
    // critical declinations at current lattitude that would cause a polar day/night
    // again, not adjusting for diameter of solar disc or atmospheric refraction.
    const polarDayDeclination = computed(() => {
        if (freezeProps.value.latitude >= 0)
            return rad(90 - freezeProps.value.latitude /*- 0.833*/)
        else {
            return rad(-90 - freezeProps.value.latitude /*- 0.833*/) 
        }
    })
    const polarNightDeclination = computed(() => -polarDayDeclination.value)
    const declinationPlotsParams = computed<{
        label: DeclinationPlotLabel,
        declination: number,
        color: string,
        show:boolean
    }[]>(() => [
        {
            label: "december-solstice",
            declination: -obliquityOfTheEcliptic2023,
            color: "#ffffff",
            show: true
        },
        {
            label: "june-solstice",
            declination: obliquityOfTheEcliptic2023,
            color: "#ffffff",
            show: true
        },
        {
            label: "equinox",
            declination: 0,
            color: "#ffffff",
            show: freezeProps.value.showEquinoxLine
        },
        {
            label: "polar-day",
            declination: polarDayDeclination.value,
            color: "#EE442F", // https://venngage.com/blog/color-blind-friendly-palette/
            show: showPolarDayAndNight.value
        },
        {
            label: "polar-night",
            declination: polarNightDeclination.value,
            color: "#601A4A",
            show: showPolarDayAndNight.value
        },
    ])

    const declinationPlots = computed(() => 
        declinationPlotsParams.value.map((params) => {
            const points = declinationPlotHours.map((hour) => {
                const hourAngle = (hour - 12) / 24 * Math.PI * 2 // radians
                const { azimuth, altitude } = toHorizontalCoords(params.declination, hourAngle, freezeProps.value.latitude * Math.PI / 180)
                const { x, y, z } = horizontalToActualCoords(azimuth, altitude)
                const plateIntersection = new Ray(gnomonAbsolutePosition.value, new Vector3(-x, -y, -z)).intersectPlane(platePlane.value, new Vector3())
                // elevate slightly off plate
                return plateIntersection?.add(plateToPlotVector.value) ?? null
            })
            const line = extractCloseAndPadSequence(points, declinationPlotHours.length + 1, new Vector3(0, 0, 0));

            return {...params, line}
        })
    )

        
    // define clipping planes for the plot.
    const relativeClippingPlanesArgs = computed(() => [
        {
            normal: new Vector3(1, 0, 0),
            coplanarPoint: new Vector3(-freezeProps.value.radius, 0, 0).add(freezeProps.value.origin)
        },
        {
            normal: new Vector3(-1, 0, 0),
            coplanarPoint: new Vector3(freezeProps.value.radius, 0, 0).add(freezeProps.value.origin)
        },
        {
            normal: new Vector3(0, 0, 1),
            coplanarPoint: new Vector3(0, 0, -freezeProps.value.radius).add(freezeProps.value.origin)
        },
        {
            normal: new Vector3(0, 0, -1),
            coplanarPoint: new Vector3(0, 0, freezeProps.value.radius).add(freezeProps.value.origin)
        },
    ]);

    const clippingPlanes = computed(() => {

        const planes : Plane[] = []

        for (let {normal, coplanarPoint} of relativeClippingPlanesArgs.value) {
            planes.push(new Plane().setFromNormalAndCoplanarPoint(
                normal.clone()
                    .applyEuler(freezeProps.value.rotation),
                coplanarPoint.clone()
                    .add(freezeProps.value.origin.clone().multiplyScalar(-1))
                    .applyEuler(freezeProps.value.rotation)
                    .add(freezeProps.value.origin),
            ))
        }

        return planes
    })


    
    // work out what declination line (summer/winter) to put the numerals on.
    const declinationLineOfNumerals = computed <DeclinationPlotLabel>(() => {
        // make a ray starting from the nodus, pointing towards the north star.
        // if this ray intersercts the sundial plate plane (infinitely extended), then use the winter solstice. Otherwise use the summer solstice.
        const ray = new Ray(gnomonAbsolutePosition.value, new Vector3(0, Math.cos(rad(90-freezeProps.value.latitude)), -Math.sin(rad(90-freezeProps.value.latitude))))
        const intersect = ray.intersectsPlane(platePlane.value)
        
        if (["babylonian", "italian", "seasonal"].includes(freezeProps.value.hourLineStyle) && showPolarDayAndNight) {
            return intersect ? "polar-night" : "polar-day"
        } else {
            return intersect ? "december-solstice" : "june-solstice"
        }
        
    })


   
    /**Normalized direction vector (or approx) of each hour line */
    const hourLineDirections = computed(() => {
        switch (freezeProps.value.hourLineStyle) {
            case 'modern-local':
            case 'modern-mean-solar':
            case 'modern-apparent-solar':
            {
                // Approach: calculate the shadow projection angle using the same code as the trad sundial.

                // The hours expressed in the range midnight to midnight, 0 to 2π
                const hourLineTimeAngles = hourLinePlotHours.map(i => {
                    let offsetHour;
                    if (freezeProps.value.hourLineStyle == 'modern-local') {
                        // need to adjust for longitude
                        offsetHour = i + freezeProps.value.longitude * 24 / 360
                    }
                    else {
                        offsetHour = i;
                    }
                    return ((((offsetHour * 60) % 1440) + 1440) % 1440) * Math.PI * 2 / 1440
                })

                return hourLineTimeAngles.map(timeAngle => 
                    calculateShadowDirection(
                        timeAngle - (freezeProps.value.hourLineStyle == "modern-local" ? freezeProps.value.timeZone / 1440 * Math.PI * 2 : 0),
                        freezeProps.value.latitude * Math.PI / 180,
                        sundialNormal.value
                    )
                    .normalize()
                    .multiplyScalar(declinationLineOfNumerals.value == "december-solstice" ? 1 : -1)
                )
            }
            case 'babylonian':
            case 'italian':
            case 'seasonal':
                {
                    // get the label to appear on the correct side of the line
                    // for babylonian and italian, place it on the inside of declination line because the hour lines can get very steep relative to it- 
                    // placing labels on the outside would make it difficult to mentally connect the labels and hour lines in some cases
                    let hourLineDirectionMultiplyer = 1
                    if (["december-solstice", "polar-night"].includes(declinationLineOfNumerals.value)) hourLineDirectionMultiplyer *= -1
                    if (freezeProps.value.hourLineStyle == "seasonal") hourLineDirectionMultiplyer *= -1
                    
                    // approach: use dir between 2 points.
                    return hourLinePlotLines.value.map(({line}) => 
                        new Vector3().subVectors(line[line.length-1], line[0])
                        .normalize()
                        .multiplyScalar(hourLineDirectionMultiplyer)

                    )
                }
            default:
                return assertUnreachable(freezeProps.value.hourLineStyle)
        }
    })

    const numeralDistanceFromDeclinationLine = 0.2
    const hourLineDigitMinDistanceToInsideBorder = 0.15;


    /**
    * Day upon which the labels are plotted.
    * NOTE polar night/day use the same values as december/june solstice respectively - 
    * This is because the projected point is clamped to the polar night/day lines later (where applicable.)
    */
    const declinationLineOfNumeralsDay = computed(() => {
        switch (declinationLineOfNumerals.value) {
            case "december-solstice":
            case "polar-night":
                return 354
            case "june-solstice":
            case "polar-day":
                return 171
            case 'equinox':
                return 78
            default:
                return assertUnreachable(declinationLineOfNumerals.value)
        }
    })

    // world coords
    const hourLineDigitPositions = computed(() => 
        hourLinePlotHours.map((hour, i) => {
            const pos = projectionOnPlate(hour, declinationLineOfNumeralsDay.value, freezeProps.value.hourLineStyle)
                ?.add(
                    hourLineDirections.value[i]
                    .clone()
                    .multiplyScalar(numeralDistanceFromDeclinationLine)
                );
            if (!pos) return null

            // check if pos is on the plate
            // reuse the clipping planes
            for (let plane of clippingPlanes.value) {
                const p = plane.clone()
                p.constant -= hourLineDigitMinDistanceToInsideBorder;
                if (p.distanceToPoint(pos) < 0) {
                    return null
                }
            }

            return pos
        })

    )

    /** Some hour systems start at 1. Compute that here. */
    const firstHourNumber = computed(() => {
        switch (freezeProps.value.hourLineStyle) {
            case 'modern-local':
            case 'modern-mean-solar':
            case 'modern-apparent-solar':
            case 'italian':
                return 0
            case 'babylonian':
            case 'seasonal':
                return 1
            default:
                return assertUnreachable(freezeProps.value.hourLineStyle)
        }
    })

    // relative coords
    const hourLineDigits = computed(() => {

        return hourLinePlotHours.map((hour, i) => ({
            hour:hour,
            label:hourLineDigitPositions.value[i] ? ((hour + firstHourNumber.value).toString()) : "",
            // transform to relative coords
            pos: hourLineDigitPositions.value[i]
                ?.sub(freezeProps.value.origin)
                .applyMatrix4(new Matrix4().makeRotationFromEuler(freezeProps.value.rotation).invert())
                ?? new Vector3(0,0,0),
            show: !(freezeProps.value.hourLineStyle == "seasonal" && i > 12)
        }))
    })

    const fontSize = computed(() => {
        // changing the text size causes a big lag spike
        // only do it when this sundial is actually shown
        if (!freezeProps.value.show) return 0.12

        const nodusHeight = new Vector3(0,0,0).distanceTo(freezeProps.value.gnomonPosition)
        if (nodusHeight < 1) return 0.055
        else return 0.12
    })

const plateGeometryArgs = computed<[number, number, number]>(() => [freezeProps.value.radius * 2, 0.1, freezeProps.value.radius * 2])
const rotationCopy = computed(() => freezeProps.value.rotation.clone())
const lineToNodusPoints = computed<[number, number, number][]>(() => [[0,0,0], freezeProps.value.gnomonPosition.toArray()])
const gnomonPositionCopy = computed(() => freezeProps.value.gnomonPosition.clone())

</script>


<template>
    <!-- plot -->
    <TresObject3D :visible="props.show">
        <!-- hour lines -->
        <template v-for="hourLine of hourLinePlotLines" :key="hourLine.hour">
            <TresObject3D :visible="hourLine.show" >
                <Line2Clipped :line-width="1" :points="hourLine.line" color="#ffffff" :clipping-planes="clippingPlanes" />
            </TresObject3D>
        </template>
        <!-- declination plots -->
        <template v-for="yearlyPlot of declinationPlots" :key="yearlyPlot.label">
            <TresObject3D :visible="yearlyPlot.show">
                <Line2Clipped :line-width="1" :points="yearlyPlot.line" :color="yearlyPlot.color"
                    :clipping-planes="clippingPlanes" />

            </TresObject3D>
        </template>

    </TresObject3D>

    <TresObject3D :visible="props.show" :position="freezeProps.origin" :rotation="rotationCopy">

        <!-- plate -->
        <TresMesh :position="[0, -0.05, 0]" cast-shadow receive-shadow>
            <TresBoxGeometry :args="plateGeometryArgs" />
            <TresMeshPhongMaterial color="#f9ecec" />
        </TresMesh>

        <!-- digits -->
        <template v-for="digit of hourLineDigits" :key="digit.hour">
            <TresObject3D :visible="digit.show">
                <SundialLetter receive-shadow :position="digit.pos" :text="digit.label" :size="fontSize" />
            </TresObject3D>
        </template>

        <!-- nodus -->
        <TresMesh :position="gnomonPositionCopy" cast-shadow receive-shadow>
            <TresSphereGeometry :args="[0.08, 20, 16]" />
            <TresMeshPhongMaterial color="#b7b7b7" />
        </TresMesh>

        <!-- line to nodus -->
        <Line2 :line-width="2" :points="lineToNodusPoints" color="#ffffff" />


    </TresObject3D>

</template>