<!-- 3D sphere representing the sun -->

<script setup lang="ts">
    import { PropType, defineProps, computed } from 'vue';

    const props = defineProps({
        position: {
            required: true,
            type: Object as PropType<{x:number, y:number, z:number}>,
        }
    })

    // have to copy this for some reason idk make it an array for good measure
    const positionCopy = computed<[number, number, number]>(() => [props.position.x, props.position.y, props.position.z])
    

</script>

<template>
    <!-- sun wrapper -->
    <TresObject3D :position="positionCopy">
        <!-- sun -->
        <TresMesh>
            <TresSphereGeometry :args="[0.5, 20, 16,]" />
            <TresMeshBasicMaterial color="#ffffff" />
        </TresMesh>

    </TresObject3D>
</template>
