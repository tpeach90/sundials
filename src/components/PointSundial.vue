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
        numerals: {
            required: true,
            type: String as PropType<"roman" | "arabic">
        },

    });

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
        // sun pos
        const {azimuth, altitude} = calculateSunHorizontalCoords(day, hour*60, props.latitude, props.longitude)
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






</script>


<template>
    <!-- plot -->
    <TresObject3D :visible="props.show">
        <template v-for="hourLine of hourLinePlot" :key="hourLine.hour">
            <Line2 :line-width="1" :points="hourLine.line" color="#ffffff" />
        </template>
        <template v-for="solsticeLine of solsticePlot" :key="solsticeLine.date">
            <Line2 :line-width="1" :points="solsticeLine.line" color="#ffffff" />
        </template>
    </TresObject3D>

    <TresObject3D :visible="props.show" :position="origin" :rotation="new Euler(/* @ts-ignore */...rotation.toArray())">

        <!-- plate -->
        <TresMesh :position="[0, -0.05, 0]" cast-shadow receive-shadow>
            <TresBoxGeometry :args="[radius*2,0.1, radius*2]" />
            <TresMeshPhongMaterial color="#f9ecec" />
        </TresMesh>

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
import { PropType, computed, defineComponent, defineProps } from 'vue'
import { Euler, Plane, Ray, Vector3 } from 'three';
import { Line2 } from '@tresjs/cientos';
import { calculateSunHorizontalCoords, horizontalToActualCoords, nonNullSequence, padWithRepeatedLastElement } from '@/calculations';

export default defineComponent({
    name: "PointSundial",
    components: {
        // SundialLetter,
    },
})
</script>