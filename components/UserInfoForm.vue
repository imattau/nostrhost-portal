<script setup lang="ts">
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/yup'
import * as yup from 'yup'
import { pick } from '@/utils/common'
import type { User } from '@/composables/states'
import type { Feedback } from '@/composables/form'

const { t } = useI18n()

const user = await useUser()
const loading: Ref<boolean> = ref(false)
const feedback: Ref<Feedback> = ref(null)

const { handleSubmit, setFieldError, resetForm, meta } = useForm({
  validationSchema: toTypedSchema(
    yup.object({
      fullname: yup.string().required().min(2),
    }),
  ),
  initialValues: {
    ...pick(user.value, 'fullname'),
  },
})

watch(
  () => meta.value.dirty,
  (value) => {
    // remove global feedback on edition
    if (value) {
      feedback.value = null
    }
  },
)

const onSubmit = handleSubmit(async (form) => {
  loading.value = true

  const { error, data } = await useApi<Pick<User, 'fullname'>>('/update', {
    method: 'PUT',
    body: form,
  })

  if (error.value) {
    // Reset form dirty state but keep previous values
    resetForm({ values: form })
    const errData = error.value.data
    let message

    if (errData.path) {
      setFieldError(errData.path, errData.error)
      message = t('form_has_errors')
    } else {
      message = errData.error || errData
    }
    feedback.value = {
      variant: 'error',
      icon: 'alert',
      message,
    }
  } else if (data.value) {
    Object.assign(user.value, data.value)
    resetForm({
      values: data.value,
    })
    feedback.value = {
      variant: 'success',
      icon: 'thumb-up',
      message: t('user_profile_updated'),
    }
  }

  loading.value = false
})
</script>

<template>
  <YForm :loading="loading" :feedback="feedback" @submit.prevent="onSubmit">
    <FormField name="fullname" :label="$t('fullname')" class="mb-6">
      <TextInput
        name="fullname"
        type="text"
        :placeholder="$t('fullname')"
        autocomplete="name"
        class="w-full"
      />
    </FormField>
  </YForm>
</template>
