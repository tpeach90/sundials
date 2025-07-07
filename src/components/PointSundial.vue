<!-- 3D object of the sundial -->

<script setup lang="ts">

import { PropType, computed, defineProps, ref, watch } from 'vue'
import { Euler, Matrix4, Plane, Ray, Vector3 } from 'three';
import Line2Clipped from './Line2FromCientosPackageAndItsTheSameButYouCanAlsoUseClippingPlanesSoItsNot.vue';
import { Line2 } from "@tresjs/cientos";
import { calculateShadowDirection, calculateSunHorizontalCoordsFromApparentSolarTime, calculateSunHorizontalCoordsFromUTC, horizontalToActualCoords, nonNullSequence, padWithRepeatedLastElement, rad } from '@/calculations';
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
                // convert apparent time to mean and then do the above
                // OR you could not use this method of calculation and instead intersect the lines with the solstice curves (you will need to find the equations of those)
            case 'babylonian':
                horizontalCoords = { azimuth: 0, altitude: 0 }
                break
                // add ast sunrise (- 1??) to find apparent solar time.
                // https://en.wikipedia.org/wiki/Sunrise_equation
                // there will be some slight inaccuracy due to length of days being different... probably
            case 'italian':
                horizontalCoords = { azimuth: 0, altitude: 0 }
                break
                // add ast sunset to find apparent solar time
            case 'seasonal':
                horizontalCoords = { azimuth: 0, altitude: 0 }
                break
                // do something weird idk
            default:
                alert(hourLineStyle)
                horizontalCoords = { azimuth: 0, altitude: 0 }
                break
        }

        // sun pos


        const sunPos = horizontalToActualCoords(horizontalCoords.azimuth, horizontalCoords.altitude)

        // shadow projection on plate
        const ray = new Ray(gnomonAbsolutePosition.value, new Vector3(-sunPos.x, -sunPos.y, -sunPos.z))
        const intersection = ray.intersectPlane(platePlane.value, new Vector3())

        return intersection?.add(plateToPlotVector.value) ?? null
    }



    const hourLinePlotHours = [...Array(24).keys()];
    const hourLinePlotDays = [...Array(37).keys()].map(x => 10*x)
    // [hour][day] -> projection point.
    const hourLinePlotData = computed(() => {
        return hourLinePlotHours.map(hour => 
            hourLinePlotDays.map(day => {
                return projectionOnPlate(hour, day, freezeProps.value.hourLineStyle)
            })
        )
    })



    const hourLinePlot = computed(() => {
        let hourLines : {
            hour:number,
            line:Vector3[]
        }[] = []



        for (const [i, points] of hourLinePlotData.value.entries()) {
            // there may be nulls in the hour plot.
            // eg it may look like this:
            // [null null null null Vector3 Vector3 Vector3 null null ...]
            // collect the part of the list that is non null
            // have to keep the number of points in the line constant otherwise cientos complains
            // make the lines 1 longer than the number of points, so they can be made closed if needed.
            // if a line segment is shorter than needed, pad with the last value of the array.
            

            let line = nonNullSequence(points)

            if (line.length == 0) {
                // make an "empty" line where all points are the same - rendering it invisible
                line.push(new Vector3(0,0,0))
            } else if (line.length == hourLinePlotDays.length) {
                // make it closed
                line.push(line[0])
            }

            padWithRepeatedLastElement(line, hourLinePlotDays.length + 1)

            hourLines.push({
                hour: hourLinePlotHours[i],
                line: line
            })

        }
        return hourLines
    })

    

    const solsticePlotDays = [171, 354];
    const solsticePlotHours = [...Array(48).keys()].map(x => x/2)
    const solsticePlotData = computed(() => 
         solsticePlotDays.map(day => 
            solsticePlotHours.map(hour => 
                projectionOnPlate(hour, day, freezeProps.value.hourLineStyle) 
            )
        )
    )

    const solsticePlot = computed(() => 
        [...solsticePlotData.value.entries()].map(([i, points]) => {
            let line = nonNullSequence(points)

            if (line.length == 0) {
                // make an "empty" line where all points are the same - rendering it invisible
                line.push(new Vector3(0, 0, 0))
            } else if (line.length == solsticePlotHours.length) {
                // make it closed
                line.push(line[0])
            }

            padWithRepeatedLastElement(line, solsticePlotHours.length + 1)

            return {
                date: solsticePlotDays[i],
                line: line
            }

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





    // The hours expressed in the range midnight to midnight, 0 to 2π
    const hourLineTimeAngles = computed(() => hourLinePlotHours.map(i => {
        let offsetHour;
        if (freezeProps.value.hourLineStyle == 'modern-local') {
            // need to adjust for longitude
            offsetHour = i + freezeProps.value.longitude * 24 / 360
        }
        else {
            offsetHour = i;
        }
        return ((((offsetHour * 60) % 1440) + 1440) % 1440) * Math.PI * 2 / 1440
    }))

    
    // work out what solstice line to put the numerals on.
    const solsticeLineOfNumerals = computed(() => {
        // make a ray starting from the nodus, pointing towards the north start.
        // if this ray intersercts the sundial plate plane (infinitely extended), then use the winter solstice. Otherwise use the summer solstice.
        const ray = new Ray(gnomonAbsolutePosition.value, new Vector3(0, Math.cos(rad(90-freezeProps.value.latitude)), -Math.sin(rad(90-freezeProps.value.latitude))))
        const intersect = ray.intersectsPlane(platePlane.value)
        return intersect ? "winter" : "summer"
    })
    
    // direction vector of each hour line on the sundial
    // need this to work out where to position the digits
    const hourLineDirections = computed(() => hourLineTimeAngles.value.map(timeAngle => {
        return calculateShadowDirection(
            timeAngle - (freezeProps.value.hourLineStyle == "modern-local" ? freezeProps.value.timeZone/1440*Math.PI*2 : 0),
            freezeProps.value.latitude * Math.PI / 180,
            sundialNormal.value
        ).normalize().multiplyScalar(0.2 * (solsticeLineOfNumerals.value == "winter" ? 1 : -1))
    }));
    const hourLineDigitMaxDistanceToInsideBorder = 0.15;

    // world coords
    const hourLineDigitPositions = computed(() => {

        const day = (() => {
            switch (solsticeLineOfNumerals.value) {
                case "winter":
                    return 354
                case "summer":
                    return 171
            }
        })()

        return hourLinePlotHours.map((hour, i) => {
            const pos = projectionOnPlate(hourLinePlotHours[i], day, freezeProps.value.hourLineStyle)?.add(hourLineDirections.value[i]);
            if (!pos) return null

            // check if pos is on the plate
            // reuse the clipping planes
            for (let plane of clippingPlanes.value) {
                const p = plane.clone()
                p.constant -= hourLineDigitMaxDistanceToInsideBorder;
                if (p.distanceToPoint(pos) < 0) {
                    return null
                }
            }

            return pos

        })

    })

    // relative coords
    const hourLineDigits = computed(() => {

        return hourLinePlotHours.map((hour, i) => ({
            hour:hour,
            label:hourLineDigitPositions.value[i] ? hour.toString() : "",
            // transform to relative coords
            pos: hourLineDigitPositions.value[i]
                ?.sub(freezeProps.value.origin)
                .applyMatrix4(new Matrix4().makeRotationFromEuler(freezeProps.value.rotation).invert())
                ?? new Vector3(0,0,0)
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
        <template v-for="hourLine of hourLinePlot" :key="hourLine.hour">
            <Line2Clipped :line-width="1" :points="hourLine.line" color="#ffffff"
                :clipping-planes="clippingPlanes" />
        </template>
        <template v-for="solsticeLine of solsticePlot" :key="solsticeLine.date">
            <Line2Clipped :line-width="1" :points="solsticeLine.line" color="#ffffff"
                :clipping-planes="clippingPlanes" />
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
            <SundialLetter receive-shadow :position="digit.pos" :text="digit.label" :size="fontSize"/>
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