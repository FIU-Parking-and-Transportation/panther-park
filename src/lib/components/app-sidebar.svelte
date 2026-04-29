<script lang="ts" module>
  import type { Component } from "svelte";
  import CarIcon from "@lucide/svelte/icons/car";
  import CreditCardIcon from "@lucide/svelte/icons/credit-card";
  import FileSearchIcon from "@lucide/svelte/icons/file-search";
  import FileTextIcon from "@lucide/svelte/icons/file-text";
  import HeadphonesIcon from "@lucide/svelte/icons/headphones";
  import KeyRoundIcon from "@lucide/svelte/icons/key-round";
  import LayoutDashboardIcon from "@lucide/svelte/icons/layout-dashboard";
  import MessageSquareIcon from "@lucide/svelte/icons/message-square";
  import Settings2Icon from "@lucide/svelte/icons/settings-2";
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
  import ShieldIcon from "@lucide/svelte/icons/shield";
  import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";
  import UserIcon from "@lucide/svelte/icons/user";
  import UsersIcon from "@lucide/svelte/icons/users";

  export type Role = "backoffice" | "admin" | "customer";

  export interface NavItem {
    title: string;
    url: string;
    icon: Component;
  }

  export interface NavGroup {
    title: string;
    items: NavItem[];
  }

  export const navByRole: Record<Role, NavGroup[]> = {
    backoffice: [
      {
        title: "",
        items: [
          { title: "Overview", url: "/dashboard/backoffice", icon: LayoutDashboardIcon },
          { title: "Settings", url: "/dashboard/backoffice/settings", icon: Settings2Icon },
        ],
      },
      {
        title: "Records",
        items: [
          { title: "Customers", url: "/dashboard/backoffice/records/customers", icon: UsersIcon },
          { title: "Vehicles", url: "/dashboard/backoffice/records/vehicles", icon: CarIcon },
          { title: "Permits", url: "/dashboard/backoffice/records/permits", icon: FileTextIcon },
          { title: "Appeals", url: "/dashboard/backoffice/records/appeals", icon: MessageSquareIcon },
          { title: "Citations", url: "/dashboard/backoffice/records/citations", icon: TriangleAlertIcon },
        ],
      },
    ],
    admin: [
      {
        title: "",
        items: [
          { title: "Overview", url: "/dashboard/admin", icon: LayoutDashboardIcon },
          { title: "Settings", url: "/dashboard/admin/settings", icon: Settings2Icon },
        ],
      },
      {
        title: "Users",
        items: [
          { title: "All Users", url: "/dashboard/admin/users", icon: UsersIcon },
          { title: "Roles & Permissions", url: "/dashboard/admin/roles", icon: ShieldCheckIcon },
        ],
      },
      {
        title: "System",
        items: [
          { title: "API Keys", url: "/dashboard/admin/api-keys", icon: KeyRoundIcon },
          { title: "Configuration", url: "/dashboard/admin/system", icon: SettingsIcon },
        ],
      },
      {
        title: "Logs",
        items: [{ title: "Audit Log", url: "/dashboard/admin/audit", icon: FileSearchIcon }],
      },
    ],
    customer: [
      {
        title: "",
        items: [
          { title: "Overview", url: "/dashboard/my", icon: LayoutDashboardIcon },
          { title: "Settings", url: "/dashboard/my/settings", icon: Settings2Icon },
        ],
      },
      {
        title: "My Account",
        items: [
          { title: "My Permits", url: "/dashboard/my/permits", icon: FileTextIcon },
          { title: "My Vehicles", url: "/dashboard/my/vehicles", icon: CarIcon },
          { title: "Citations", url: "/dashboard/my/citations", icon: TriangleAlertIcon },
        ],
      },
      {
        title: "Payments",
        items: [{ title: "Payment History", url: "/dashboard/my/payments", icon: CreditCardIcon }],
      },
      {
        title: "Profile",
        items: [{ title: "My Profile", url: "/dashboard/my/profile", icon: UserIcon }],
      },
    ],
  };

  export const roles: { value: Role; label: string; icon: Component }[] = [
    { value: "backoffice", label: "Backoffice", icon: HeadphonesIcon },
    { value: "admin", label: "Web Admin", icon: ShieldIcon },
    { value: "customer", label: "Customer", icon: UserIcon },
  ];

  export const overviewByRole: Record<Role, string> = {
    backoffice: "/dashboard/backoffice",
    admin: "/dashboard/admin",
    customer: "/dashboard/my",
  };
</script>

<script lang="ts">
  import RoleSwitcher from "./role-switcher.svelte";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import type { ComponentProps } from "svelte";

  let { ref = $bindable(null), ...restProps }: ComponentProps<typeof Sidebar.Root> = $props();

  let currentRole = $state<Role>("backoffice");
  let navMain = $derived(navByRole[currentRole]);

  // Navigate to the role's overview whenever the role changes.
  // Initialise prevRole to the starting value so the effect skips the first run.
  // svelte-ignore state_referenced_locally
  let prevRole: Role = currentRole;
  $effect(() => {
    if (currentRole !== prevRole) {
      prevRole = currentRole;
      goto(overviewByRole[currentRole]);
    }
  });
</script>

<Sidebar.Root {...restProps} bind:ref>
  <Sidebar.Header>
    <RoleSwitcher {roles} bind:selectedRole={currentRole} />
  </Sidebar.Header>
  <Sidebar.Content>
    {#each navMain as group, i (i)}
      <Sidebar.Group>
        {#if group.title}
          <Sidebar.GroupLabel>{group.title}</Sidebar.GroupLabel>
        {/if}
        <Sidebar.GroupContent>
          <Sidebar.Menu>
            {#each group.items as item (item.title)}
              <Sidebar.MenuItem>
                <Sidebar.MenuButton isActive={page.url.pathname === item.url}>
                  {#snippet child({ props })}
                    {@const Icon = item.icon}
                    <a href={item.url} {...props}>
                      <Icon class="size-4" />
                      {item.title}
                    </a>
                  {/snippet}
                </Sidebar.MenuButton>
              </Sidebar.MenuItem>
            {/each}
          </Sidebar.Menu>
        </Sidebar.GroupContent>
      </Sidebar.Group>
    {/each}
  </Sidebar.Content>
  <Sidebar.Rail />
</Sidebar.Root>
