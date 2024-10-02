<script setup lang="ts">
import { GLTFModel } from '@tresjs/cientos';
import {defineProps, PropType, watch} from 'vue';
import {CompressedTextureLoader, Euler} from 'three';

const props = defineProps({
    rotation: {
        required: true,
        type: Object as PropType<Euler>
    }
})

</script>

<template>
    <!-- need to clone the rotation for some reason. -->
    <TresObject3D :rotation="props.rotation.clone()">
        <TresObject3D :rotation="[0, Math.PI, 0]">
            <Suspense>
                <GLTFModel path="./objects3d/compass.glb" />
            </Suspense>
        </TresObject3D>
    </TresObject3D>
</template>