<script setup lang="ts">
    import { Text3D } from '@tresjs/cientos';
import { TresCanvas } from '@tresjs/core';
</script>


<template>
    <TresObject3D :position="origin">
        <!-- plate -->
        <TresMesh :position="[0,-0.05,0]" cast-shadow receive-shadow>
            <!-- <TresBoxGeometry :args="[5,0.1, 5,]" /> -->
            <TresCylinderGeometry :args="[5, 5, 0.1]" />
            <TresMeshPhongMaterial color="#f9ecec" />
        </TresMesh>

        <SundialLetter text="N" :position="[0, 0, -2]" cast-shadow receive-shadow />
        <SundialLetter text="E" :position="[2, 0, 0]" cast-shadow receive-shadow />
        <SundialLetter text="S" :position="[0, 0, 2]" cast-shadow receive-shadow />
        <SundialLetter text="W" :position="[-2, 0, 0]" cast-shadow receive-shadow />

        <!-- Style/gnomon -->
        <TresMesh :position="[0,1,0]" :rotation="[-gnomonRotation, 0, 0]" cast-shadow receive-shadow>
            <TresCylinderGeometry :args="[0.05, 0.05, 2]" />
            <TresMeshPhongMaterial color="#b7b7b7" />
        </TresMesh>
    </TresObject3D>

</template>


<script lang="ts">
    import { PropType, defineComponent } from 'vue'
    import SundialLetter from './SundialLetter.vue';
    export default defineComponent({
        components: {
            SundialLetter
        },
        props:{
            gnomonRotation: {
                required: false,
                default:0,
                type: Number as PropType<number>
            },
            origin: {
                required:true,
                default: () => [0, -1, 0],
                type: Array as PropType<number[]>
            }
        }
    })
</script>