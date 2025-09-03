<script setup lang="ts">
import { Color, Euler, Vector3 } from 'three';
import { PropType, computed, defineProps } from 'vue';

const props = defineProps({
    sundialRotation: {
        required: true,
        type: Object as PropType<Euler>
    },
    show:{
        required: true,
        type: Boolean as PropType<boolean>
    },
    origin: {
        required: true,
        type: Object as PropType<Vector3>
    },
    radius: {
        required: true,
        type: Number as PropType<number>
    },
    colorPalette: {
        required: true,
        type: String as PropType<"dark" | "light">
    }
})

const size = computed(() => props.radius * 2);
const minorLineDivisions = computed(() => size.value*10);
const majorLineDivisions = computed(() => size.value)

const minorLineGridHelperArgsLight = computed(() => [size.value, minorLineDivisions.value, new Color("#909090"), new Color("#909090")] as const)
const majorLineGridHelperArgsLight = computed(() => [size.value, majorLineDivisions.value, new Color("#666666"), new Color("#666666")] as const)

const minorLineGridHelperArgsDark = computed(() => [size.value, minorLineDivisions.value, new Color("#909090"), new Color("#909090")] as const)
const majorLineGridHelperArgsDark = computed(() => [size.value, majorLineDivisions.value, new Color("#ffffff"), new Color("#ffffff")] as const)

const lightGridsVisible = computed(() => props.colorPalette == "light" && props.show)
const darkGridsVisible = computed(() => props.colorPalette == "dark" && props.show)



</script>

<template>
    <TresGridHelper :visible="lightGridsVisible" :args="minorLineGridHelperArgsLight" :position="props.origin"
        :rotation="props.sundialRotation" />
    <TresGridHelper :visible="lightGridsVisible" :args="majorLineGridHelperArgsLight" :position="props.origin"
        :rotation="props.sundialRotation" />

    <TresGridHelper :visible="darkGridsVisible" :args="minorLineGridHelperArgsDark" :position="props.origin"
        :rotation="props.sundialRotation" />
    <TresGridHelper :visible="darkGridsVisible" :args="majorLineGridHelperArgsDark" :position="props.origin"
        :rotation="props.sundialRotation" />
</template>