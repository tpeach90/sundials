<!-- 3D sphere representing the sun -->

<template>
    <TresObject3D :position="position">
        <!-- plate -->
        <TresMesh>
            <TresSphereGeometry :args="[0.5, 20, 16,]" />
            <TresMeshBasicMaterial color="#ffffff" />
        </TresMesh>

    </TresObject3D>

</template>


<script lang="ts">
import { PropType, defineComponent } from 'vue'
export default defineComponent({
    name:"SunObject",
    props: {
        position: {
            required: true,
            type: Array as PropType<number[]>,
        },
    }
})
</script>