<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { ref } from 'vue';
import { Loader2, Send, Sparkles } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { ai } from '@/routes';
import { stream } from '@/routes/ai';

const props = defineProps<{ prompt?: string; response?: string }>();

const prompt = ref(props.prompt ?? '');
const response = ref(props.response ?? '');
const processing = ref(false);
const error = ref('');

function csrfToken(): string {
    return decodeURIComponent(document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1] ?? '');
}

async function submit() {
    if (!prompt.value.trim() || processing.value) return;
    processing.value = true;
    error.value = '';
    response.value = '';

    try {
        const res = await fetch(stream().url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'text/event-stream',
                'X-XSRF-TOKEN': csrfToken(),
            },
            body: JSON.stringify({ prompt: prompt.value }),
        });
        if (!res.ok || !res.body) throw new Error(`Request failed (${res.status})`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) {
                if (!line.startsWith('data: ') || line.includes('[DONE]')) continue;
                try {
                    const event = JSON.parse(line.slice(6));
                    if (event.type === 'text_delta') response.value += event.delta;
                } catch {
                    // ignore partial/non-JSON lines
                }
            }
        }
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Something went wrong';
    } finally {
        processing.value = false;
    }
}

defineOptions({
    layout: { breadcrumbs: [{ title: 'AI', href: ai() }] },
});
</script>

<template>
    <Head title="AI" />

    <div class="flex h-[calc(100vh-4rem)] flex-col">
        <!-- Header -->
        <div class="flex items-center gap-3 border-b px-6 py-4">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-sm">
                <Sparkles class="h-5 w-5" />
            </div>
            <div>
                <h1 class="text-lg font-semibold leading-tight">Ask AI</h1>
                <p class="text-sm text-muted-foreground">Type a prompt and get an instant response.</p>
            </div>
        </div>

        <!-- Response area (scrollable, fills space) -->
        <div class="flex-1 overflow-y-auto px-6 py-6">
            <div class="mx-auto w-full max-w-3xl">
                <!-- Empty state -->
                <div
                    v-if="!response && !processing"
                    class="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 text-center text-muted-foreground"
                >
                    <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                        <Sparkles class="h-6 w-6" />
                    </div>
                    <p class="text-sm">Ask anything to get started.</p>
                </div>

                <!-- Thinking state -->
                <div
                    v-else-if="processing && !response"
                    class="flex items-center gap-3 rounded-2xl border bg-muted/40 p-5 text-sm text-muted-foreground"
                >
                    <Loader2 class="h-4 w-4 animate-spin" />
                    Thinking...
                </div>

                <!-- Response -->
                <Transition
                    v-else
                    enter-active-class="transition duration-200 ease-out"
                    enter-from-class="opacity-0 translate-y-2"
                    enter-to-class="opacity-100 translate-y-0"
                >
                    <div class="rounded-2xl border bg-card p-5 shadow-sm">
                        <div class="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            <Sparkles class="h-3.5 w-3.5" />
                            Response
                        </div>
                        <div class="whitespace-pre-wrap text-sm leading-relaxed">{{ response }}</div>
                    </div>
                </Transition>
            </div>
        </div>

        <!-- Composer (fixed at bottom) -->
        <div class="border-t bg-background/80 px-6 py-4 backdrop-blur">
            <form
                class="mx-auto flex w-full max-w-3xl flex-col gap-2"
                @submit.prevent="submit"
            >
                <div class="relative rounded-2xl border bg-card shadow-sm transition focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
                    <textarea
                        v-model="prompt"
                        rows="3"
                        class="w-full resize-none rounded-2xl bg-transparent p-4 pr-28 text-sm leading-relaxed outline-none placeholder:text-muted-foreground disabled:opacity-50"
                        placeholder="Ask something..."
                        :disabled="processing"
                        @keydown.enter.exact.prevent="submit"
                    />

                    <div class="absolute bottom-3 right-3">
                        <Button
                            type="submit"
                            size="sm"
                            :disabled="processing || !prompt.trim()"
                        >
                            <Loader2 v-if="processing" class="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            <Send v-else class="mr-1.5 h-3.5 w-3.5" />
                            {{ processing ? 'Thinking...' : 'Send' }}
                        </Button>
                    </div>
                </div>

                <p v-if="error" class="px-1 text-sm text-destructive">
                    {{ error }}
                </p>
                <p v-else class="px-1 text-xs text-muted-foreground">
                    Press <kbd class="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium">Enter</kbd> to send
                </p>
            </form>
        </div>
    </div>
</template>