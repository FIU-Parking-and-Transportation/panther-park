<script lang="ts">
  import type { Component } from "svelte";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import CheckIcon from "@lucide/svelte/icons/check";
  import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
  import SquareParkingIcon from "@lucide/svelte/icons/square-parking";

  interface Role {
    value: string;
    label: string;
    icon: Component;
  }

  interface Props {
    roles: Role[];
    selectedRole: string;
  }

  let { roles, selectedRole = $bindable() }: Props = $props();

  let currentRole = $derived(roles.find((r) => r.value === selectedRole) ?? roles[0]);
</script>

<Sidebar.Menu>
  <Sidebar.MenuItem>
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Sidebar.MenuButton
            size="lg"
            class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            {...props}
          >
            <div
              class="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg"
            >
              <SquareParkingIcon class="size-4" />
            </div>
            <div class="flex flex-col gap-0.5 leading-none">
              <span class="font-semibold">Panther Park</span>
              <span class="">{currentRole?.label ?? ""}</span>
            </div>
            <ChevronsUpDownIcon class="ms-auto" />
          </Sidebar.MenuButton>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content class="w-(--bits-dropdown-menu-anchor-width)" align="start">
        {#each roles as role (role.value)}
          <DropdownMenu.Item onSelect={() => (selectedRole = role.value)}>
            {@const RoleIcon = role.icon}
            <RoleIcon class="size-4" />
            {role.label}
            {#if role.value === selectedRole}
              <CheckIcon class="ms-auto" />
            {/if}
          </DropdownMenu.Item>
        {/each}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </Sidebar.MenuItem>
</Sidebar.Menu>
