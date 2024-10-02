<!-- 3D object of the sundial -->
 <!-- TODO: this current updates all the computed values even if it is not shown. Maybe change that? -->

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
            default:() => new Vector3(0, 1, 0),
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
        // numerals: {
        //     required: true,
        //     type: String as PropType<"roman" | "arabic">
        // },
        numeralDistanceFromSundialOrigin: {
            required: true,
            type: Number as PropType<number>
        }

    });

    const relativeGnomonRotation = computed(() => (90-props.latitude)*Math.PI/180);

    // rotation of the gnomon relative to the sundial plate
    const gnomonCorrectedRotation = computed(() => {
        // apply the gnomon rotation and remove the object3d rotation

        const mat = new Matrix4().makeRotationFromEuler(props.rotation).invert()
            .multiply(new Matrix4().makeRotationFromEuler(new Euler(-relativeGnomonRotation.value, 0, 0)))

        return new Euler().setFromRotationMatrix(mat);

    })

    let sundialNormal = computed(() => new Vector3(0, 1, 0).applyEuler(props.rotation));

    let gnomonAbsolutePosition = computed(() => {
        return new Vector3(...props.gnomonPosition)
            .applyEuler(props.rotation)
            .add(new Vector3(...props.origin))
    })
    /** if there is an interection return it, and whether the intersection is in the positive direction of the gnomon vector.*/
    let stylePlateIntersection = computed(() => {
        // intersect the plane of the plate with the line of the sundial gnomon.
        const plane = new Plane(sundialNormal.value, 0).translate(new Vector3(...props.origin));
        const rayDir = new Vector3(0, -(Math.sin(props.latitude * Math.PI / 180)), (Math.cos(props.latitude * Math.PI / 180)));
        return infiniteLineIntersectWithPlaneWithDir(plane, gnomonAbsolutePosition.value, rayDir);
    })
    let stylePlateIntersectionPoint = computed(() => stylePlateIntersection.value?.point ?? null);
    /** If the intersection with the plate lies on the line between the center of the gnomon and celestial north, then this value is -1. If south, then 1.*/
    let stylePlateIntersectionPointOrder = computed(() => stylePlateIntersection.value?.dir ?? null)

   
    const hourLineHours = [...Array(24).keys()];

    // The hours expressed in the range midnight to midnight, 0 to 2π
    const hourLineTimeAngles = computed(() => hourLineHours.map(i => {
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

    // direction vector of each hour line on the sundial
    const hourLineDirections = computed(() => hourLineTimeAngles.value.map(timeAngle => {
        return calculateShadowDirection(
            timeAngle,
            props.latitude * Math.PI / 180,
            new Vector3(...sundialNormal.value)
        ).multiplyScalar((stylePlateIntersectionPointOrder.value ?? 1))
        // the scalar multiple is to fix a bug with the numerals being offset by 12 hours in some cases.
    }));

    /** If the style plate intersection point is really far away from the sundial origin, or doesn't exist, then we need to calculate the hour lines differently. */
    const hourLinesCalculationMethod = computed(() => {
        if (stylePlateIntersectionPoint.value && stylePlateIntersectionPoint.value.distanceTo(props.origin) < 1000) {
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
                const latRad = props.latitude * Math.PI / 180;
                const gnomon1 = gnomonAbsolutePosition.value;
                const gnomonDir = new Vector3(0, Math.sin(latRad), -Math.cos(latRad))
                const gnomon2 = gnomonDir.clone().add(gnomon1);
                // a point 1 unit off the side of the sundial plate
                const pointOutsidePlate = gnomonDir.clone()
                    .projectOnPlane(sundialNormal.value)
                    .normalize()
                    .multiplyScalar((props.radius + 1) * -(stylePlateIntersectionPointOrder.value ?? 1))
                    .add(props.origin);

                const p2 = new Plane().setFromNormalAndCoplanarPoint(sundialNormal.value, props.origin);
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
            const lambdas = infiniteLineIntersectWithSphereParameters(new Vector3(...props.origin), props.radius, point, dir);
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
            label: hour.toString(),
            points: lambdas.length == 0 ? null : [
                lineDir.clone().multiplyScalar(lambdas[0]).add(linePoint).add(plateToHourLineHeight.value),
                lineDir.clone().multiplyScalar(lambdas[1]).add(linePoint).add(plateToHourLineHeight.value),
            ],
            labelPoint: (() => {
                // where the label should be displayed.
                // Intersect the hour line with a sphere of radius smaller than the sundial radius, centered on the sundial origin
                const labelSphereIntersectLambdas = infiniteLineIntersectWithSphereParameters(new Vector3(...props.origin), props.numeralDistanceFromSundialOrigin, linePoint, lineDir);
                if (labelSphereIntersectLambdas.length == 0) return null;
                if (labelSphereIntersectLambdas[1] < 0) return null;
                const labelPoint = lineDir.clone().multiplyScalar(labelSphereIntersectLambdas[1]).add(linePoint);
                // prevent numbers from getting too bunched up
                if (hourLinesCalculationMethod.value == "stylePlateIntersection" && linePoint.distanceTo(labelPoint) < 3) return null;
                // move to relative coordinate of sundial
                labelPoint.sub(props.origin).applyMatrix4(new Matrix4().makeRotationFromEuler(props.rotation).invert())
                return labelPoint.toArray();
            })()
        }
    }));
</script>

<template>

    <!-- hour lines (calculated in world coordinates)-->
    <template v-for="hourLine in hourLines" v-bind:key="hourLine.hour">
        <Line2 :line-width="1" :points="(props.show && hourLine.points) ? hourLine.points : [[0, 0, 0], [0, 0, 0]]" color="#FFFFFF" />
    </template>

    <TresObject3D :visible="props.show" :position="origin" :rotation="new Euler(/* @ts-ignore */...rotation.toArray())">

        <!-- plate -->
        <TresMesh :position="[0,-0.05,0]" cast-shadow receive-shadow>
            <TresCylinderGeometry :args="[radius, radius, 0.1]" />
            <TresMeshPhongMaterial color="#f9ecec" />
        </TresMesh>

        <!-- numerals -->
        <template v-for="{hour, label, labelPoint} in hourLines" :key="hour">
            <SundialLetter :text="labelPoint ? label : ''" :position="labelPoint ?? [0,0,0]" receive-shadow />
        </template>

        <!-- Style/gnomon -->
        <TresMesh :position="gnomonPosition" :rotation="gnomonCorrectedRotation" cast-shadow receive-shadow>
            <TresCylinderGeometry :args="[0.05, 0.05, 2]" />
            <TresMeshPhongMaterial color="#b7b7b7" />
        </TresMesh>
    </TresObject3D>

</template>


<script lang="ts">
    import { EffectScope, PropType, computed, defineComponent, defineProps, effectScope, ref, watch } from 'vue'
    import SundialLetter from './SundialLetter.vue';
    import { Euler, Matrix4, Plane, Vector3, Vector3Tuple } from 'three';
    import { calculateShadowDirection, hourToRomanNumeral, infiniteLineIntersectWithPlaneWithDir, infiniteLineIntersectWithSphereParameters, sunPosAtEquinox, vertIntersectPlanes } from '@/calculations';
    import { Line2 } from '@tresjs/cientos'

    export default defineComponent({
        name:"DialAndGnomonSundial",
        components: {
            SundialLetter,
        },
    })
</script>