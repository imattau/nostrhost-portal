<script setup lang="ts">
import { useField } from 'vee-validate'
import { formGroupExtras } from '@/composables/form'

const props = withDefaults(
  defineProps<{
    name: string
    type: HTMLInputElement['type']
  }>(),
  {},
)
const attrs = useAttrs()
const { describedBy, invalid } = inject(formGroupExtras, {
  describedBy: ref(undefined),
  invalid: ref(false),
})
const { value, handleBlur, handleChange, errorMessage } = useField(
  () => props.name,
  {
    validateOnValueUpdate: false,
  },
)

const validationListeners = {
  blur: (e: FocusEvent) => handleBlur(e, true),
  change: handleChange,
  input: (e: InputEvent) => handleChange(e, !!errorMessage.value),
}
</script>

<template>
  <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -->
  <input
    :id="name"
    :value="value"
    :name="name"
    :type="type"
    :aria-invalid="invalid"
    :aria-describedby="describedBy"
    :class="
      cn(
        'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800',
        'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
        invalid && 'border-red-500 focus:ring-red-500 focus:border-red-500',
      )
    "
    v-bind="attrs"
    v-on="validationListeners"
  />
</template>
