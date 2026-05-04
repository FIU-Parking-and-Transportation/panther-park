<script lang="ts">
  import { FieldGroup, Field, FieldLabel } from "$lib/components/ui/field/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { cn, type WithElementRef } from "$lib/utils.js";
  import type { HTMLFormAttributes } from "svelte/elements";
  import { authClient } from "$lib/auth-client";

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: WithElementRef<HTMLFormAttributes> = $props();

  const id = $props.id();

  let email = $state("");
  let password = $state("");
  let loading = $state(false);
  let errorMessage = $state<string | null>(null);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    loading = true;
    errorMessage = null;

    const { error } = await authClient.signIn.email({
      email,
      password,
      callbackURL: "/dashboard",
    });

    if (error) {
      errorMessage = error.message ?? "An unexpected error occurred.";
      loading = false;
    }
  }
</script>

<form class={cn("flex flex-col gap-6", className)} bind:this={ref} {...restProps} onsubmit={handleSubmit}>
  <FieldGroup>
    <div class="flex flex-col items-center gap-1 text-center">
      <h1 class="text-2xl font-bold">Panther Park</h1>
      <p class="text-muted-foreground text-sm text-balance">
        Sign in to the operations dashboard
      </p>
    </div>
    <Field>
      <FieldLabel for="email-{id}">Email</FieldLabel>
      <Input id="email-{id}" type="email" placeholder="you@fiu.edu" bind:value={email} autocomplete="email" required />
    </Field>
    <Field>
      <FieldLabel for="password-{id}">Password</FieldLabel>
      <Input id="password-{id}" type="password" bind:value={password} autocomplete="current-password" required />
    </Field>
    {#if errorMessage}
      <p class="text-destructive text-sm">{errorMessage}</p>
    {/if}
    <Field>
      <Button type="submit" disabled={loading}>
        {loading ? "Signing in…" : "Sign In"}
      </Button>
    </Field>
  </FieldGroup>
</form>
