<!-- 3D object of the sundial -->

<script setup lang="ts">

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
            default: () => new Vector3(0, 1, 0),
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
            type: String as PropType<"solar" | "standard">
        },
        timeZone: {
            required: true,
            type: Number as PropType<number>
        },

    })

    const gnomonAbsolutePosition = computed(() => {
        return new Vector3(...props.gnomonPosition)
            .applyEuler(props.rotation)
            .add(new Vector3(...props.origin))
    })
    let sundialNormal = computed(() => new Vector3(0, 1, 0).applyEuler(props.rotation));


    const platePlane = computed(() => new Plane(sundialNormal.value, 0).translate(new Vector3(...props.origin)))
    // vector used to raise the plot above the surface.
    const plateToPlotVector = computed(() => sundialNormal.value.clone().normalize().multiplyScalar(0.007))

    function projectionOnPlate(hour:number, day:number) : Vector3 | null {

        // for solar time, just pretend the longitude is 0
        const longitude = (() => {
            switch(props.hourLineStyle) {
                case "solar":
                    return 0
                case "standard":
                    return props.longitude
            }
        })()

        // sun pos
        const { azimuth, altitude } = calculateSunHorizontalCoords(day, hour * 60, props.latitude, longitude)
        const sunPos = horizontalToActualCoords(azimuth, altitude)

        // shadow projection on plate
        const ray = new Ray(gnomonAbsolutePosition.value, new Vector3(-sunPos.x, -sunPos.y, -sunPos.z))
        const intersection = ray.intersectPlane(platePlane.value, new Vector3())

        return intersection?.add(plateToPlotVector.value) ?? null
    }



    const hourLinePlotHours = [...Array(24).keys()];
    // first day of each month.
    // const plotDays = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
    const hourLinePlotDays = [...Array(37).keys()].map(x => 10*x)
    // [hour][day] -> projection point.
    const hourLinePlotData = computed(() => {
        return hourLinePlotHours.map(hour => 
            hourLinePlotDays.map(day => {
                return projectionOnPlate(hour, day)
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
                projectionOnPlate(hour, day) 
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
            coplanarPoint: new Vector3(-props.radius, 0, 0).add(props.origin)
        },
        {
            normal: new Vector3(-1, 0, 0),
            coplanarPoint: new Vector3(props.radius, 0, 0).add(props.origin)
        },
        {
            normal: new Vector3(0, 0, 1),
            coplanarPoint: new Vector3(0, 0, -props.radius).add(props.origin)
        },
        {
            normal: new Vector3(0, 0, -1),
            coplanarPoint: new Vector3(0, 0, props.radius).add(props.origin)
        },
    ]);

    const clippingPlanes = computed(() => {

        const planes : Plane[] = []

        for (let {normal, coplanarPoint} of relativeClippingPlanesArgs.value) {
            planes.push(new Plane().setFromNormalAndCoplanarPoint(
                normal.clone()
                    .applyEuler(props.rotation),
                coplanarPoint.clone()
                    .add(props.origin.clone().multiplyScalar(-1))
                    .applyEuler(props.rotation)
                    .add(props.origin),
            ))
        }

        return planes
    })





    // The hours expressed in the range midnight to midnight, 0 to 2π
    const hourLineTimeAngles = computed(() => hourLinePlotHours.map(i => {
        let offsetHour;
        if (props.hourLineStyle == 'standard') {
            // need to adjust for time zones
            offsetHour = i - props.timeZone / 60 + props.longitude * 24 / 360
        }
        else {
            offsetHour = i;
        }
        return ((((offsetHour * 60) % 1440) + 1440) % 1440) * Math.PI * 2 / 1440
    }))

    
    // work out what solstice line to put the numerals on.
    const solsticeLineOfNumerals = computed(() => {
        // make a ray starting from the nodus, pointing towards the north start.
        // if this ray intersercts the sundial plate, then use the winter solstice. Otherwise use the summer solstice.
        const ray = new Ray(gnomonAbsolutePosition.value, new Vector3(0, Math.cos(rad(90-props.latitude)), -Math.sin(rad(90-props.latitude))))
        const intersect = ray.intersectsPlane(platePlane.value)
        return intersect ? "winter" : "summer"
    })
    
    // direction vector of each hour line on the sundial
    // need this to work out where to position the digits
    const hourLineDirections = computed(() => hourLineTimeAngles.value.map(timeAngle => {
        return calculateShadowDirection(
            timeAngle,
            props.latitude * Math.PI / 180,
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
            let pos :Vector3|undefined;
            if (props.hourLineStyle == "standard") {
                // projectOnPlate handles the longitude. don't need to adjust for that here
                pos = projectionOnPlate((((hourLinePlotHours[i] - props.timeZone/60) % 24) + 24)%24, day)?.add(hourLineDirections.value[i]);
            } else {
                pos = projectionOnPlate(hourLineTimeAngles.value[i] * 12/Math.PI, day)?.add(hourLineDirections.value[i]);
            }

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
                ?.sub(props.origin)
                .applyMatrix4(new Matrix4().makeRotationFromEuler(props.rotation).invert())
                ?? new Vector3(0,0,0)
        }))
    })

    const fontSize = computed(() => {
        // changing the text size causes a big lag spike
        // only do it when this sundial is actually shown
        if (!props.show) return 0.12

        const nodusHeight = new Vector3(0,0,0).distanceTo(props.gnomonPosition)
        if (nodusHeight < 1) return 0.055
        else return 0.12
    })



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

    <TresObject3D :visible="props.show" :position="origin" :rotation="new Euler(/* @ts-ignore */...rotation.toArray())">

        <!-- plate -->
        <TresMesh :position="[0, -0.05, 0]" cast-shadow receive-shadow>
            <TresBoxGeometry :args="[radius*2,0.1, radius*2]" />
            <TresMeshPhongMaterial color="#f9ecec" />
        </TresMesh>

        <!-- digits -->
        <template v-for="digit of hourLineDigits" :key="digit.hour">
            <TresObject3D :visible="digit.label != ''">
                <SundialLetter receive-shadow :position="digit.pos" :text="digit.label" :size="fontSize"/>
            </TresObject3D>
        </template>

        <!-- nodus -->
        <TresMesh :position="new Vector3(...props.gnomonPosition)" cast-shadow receive-shadow>
            <TresSphereGeometry :args="[0.08, 20, 16]" />
            <TresMeshPhongMaterial color="#b7b7b7" />
        </TresMesh>

        <!-- line to nodus -->
        <Line2 :line-width="2" :points="[[0,0,0], props.gnomonPosition.toArray()]" color="#ffffff" />


    </TresObject3D>

</template>


<script lang="ts">
import { PropType, computed, defineComponent, defineProps, ref, watch } from 'vue'
import { Euler, Matrix4, Plane, Ray, Vector3 } from 'three';
import Line2Clipped from './Line2FromCientosPackageAndItsTheSameButYouCanAlsoUseClippingPlanesSoItsNot.vue';
import {Line2} from "@tresjs/cientos";
import { calculateShadowDirection, calculateSunHorizontalCoords, horizontalToActualCoords, nonNullSequence, padWithRepeatedLastElement, rad } from '@/calculations';
import SundialLetter from './SundialLetter.vue';

export default defineComponent({
    name: "PointSundial",
    components: {
        // SundialLetter,
    },
})
</script>