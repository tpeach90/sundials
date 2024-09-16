<!-- 3D object of the sundial -->

<script setup lang="ts">

    const props = defineProps(
    {
        latitude: {
            required: false,
            default: 0,
            type: Number as PropType<number>
        },
        radius: {
            required: true,
            type: Number as PropType<number>
        },
        gnomonPosition: {
            required: true,
            default:() => [0, 1, 0],
            type: Array as PropType<number[]>
        },
        origin: {
            required: true,
            default: () => new Vector3(0, -1, 0),
            type: Object as PropType<Vector3>
        },
        rotation: {
            required: true,
            default: () => new Euler(0, 0, 0),
            type: Object as PropType<Euler>
        },
        hourLabels: {
            required: true,
            type: Array as PropType<{
                hour: number,
                label: string,
                labelPoint: number[] | null
            }[]>
        }

    });

    const relativeGnomonRotation = computed(() => (90-props.latitude)*Math.PI/180);

    const gnomonCorrectedRotation = computed(() => {
        // apply the gnomon rotation and remove the object3d rotation

        const mat = new Matrix4().makeRotationFromEuler(props.rotation).invert()
            .multiply(new Matrix4().makeRotationFromEuler(new Euler(-relativeGnomonRotation.value, 0, 0)))

        return new Euler().setFromRotationMatrix(mat);

    })
</script>

<template>
    <TresObject3D :position="origin" :rotation="new Euler(/* @ts-ignore */...rotation.toArray())">
        <!-- plate -->
        <TresMesh :position="[0,-0.05,0]" cast-shadow receive-shadow>
            <!-- <TresBoxGeometry :args="[5,0.1, 5,]" /> -->
            <TresCylinderGeometry :args="[radius, radius, 0.1]" />
            <TresMeshPhongMaterial color="#f9ecec" />
        </TresMesh>

        <template v-for="{hour, label, labelPoint} in hourLabels" :key="hour">
            <SundialLetter :text="labelPoint ? label : ''" :position="labelPoint ?? [0,0,0]" receive-shadow/>
        </template>
  
        <!-- Style/gnomon -->
        <TresMesh :position="gnomonPosition" :rotation="gnomonCorrectedRotation" cast-shadow receive-shadow>
            <TresCylinderGeometry :args="[0.05, 0.05, 2]" />
            <TresMeshPhongMaterial color="#b7b7b7" />
        </TresMesh>
    </TresObject3D>

</template>


<script lang="ts">
    import { PropType, computed, defineComponent, defineProps } from 'vue'
    import SundialLetter from './SundialLetter.vue';
    import { Euler, Matrix4, Vector3 } from 'three';
    export default defineComponent({
        name:"SundialObject",
        components: {
            SundialLetter,
        },
    })
</script>