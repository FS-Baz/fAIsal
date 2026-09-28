<script setup lang="ts">
import { Head, useForm } from '@inertiajs/vue3';
import { Button } from '@/components/ui/button';
import { ai } from '@/routes';
import { ask } from '@/routes/ai';

const props = defineProps<{ prompt?: string; response?: string }>();

const form = useForm({ prompt: props.prompt ?? '' });

defineOptions({
    layout: { breadcrumbs: [{ title: 'AI', href: ai() }] },
});
</script>

<template>
    <Head title="AI" />

    <div class="flex flex-col gap-4 p-4">
        <form class="flex flex-col gap-2" @submit.prevent="form.post(ask().url, { preserveState: true })">
            <textarea
                v-model="form.prompt"
                rows="5"
                class="rounded-md border border-input bg-transparent p-3 text-sm"
                placeholder="Ask something..."
            />
            <p v-if="form.errors.prompt" class="text-sm text-red-600">{{ form.errors.prompt }}</p>
            <Button type="submit" class="self-start" :disabled="form.processing">
                {{ form.processing ? 'Thinking...' : 'Send' }}
            </Button>
        </form>

        <div v-if="response" class="rounded-md border p-3 text-sm whitespace-pre-wrap">{{ response }}</div>
    </div>
</template>
