<script setup lang="ts">
import { Text3D } from '@tresjs/cientos';
import { TresCanvas } from '@tresjs/core';
</script>


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
    props: {
        position: {
            required: true,
            type: Array as PropType<number[]>,
        },
    }
})
</script>