import type { CSSProperties } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BookOpen,
  NotebookPen,
  Settings,
  Sparkles,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react'

import { TaskCard } from '@/components/task-card'
import { ThemeToggle } from '@/components/theme-toggle'
import { Badge } from '@/components/ui/badge'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { useHealth } from '@/hooks/use-health'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  end?: boolean
  soon?: boolean
}

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Library',
    items: [{ label: 'Books', to: '/', icon: BookOpen, end: true }],
  },
  {
    label: 'Study',
    items: [
      { label: 'Homework', to: '/homework', icon: NotebookPen, end: true },
      { label: 'Ask', to: '/ask', icon: Sparkles },
    ],
  },
  {
    label: 'System',
    items: [{ label: 'Doctor', to: '/doctor', icon: Stethoscope }],
  },
]

// Tasks and Settings live at the bottom of the rail. The Tasks nav item is
// permanent — the way to the history on /tasks — and when a task is active a
// panel grows upward out of it, wrapping the live task in the rail's dark
// space. Settings sits under it as a labelled row of its own.
const settingsItem: NavItem = { label: 'Settings', to: '/settings', icon: Settings }

const sectionLabels = new Map([
  ...navGroups.flatMap((g) => g.items.map((i) => [i.to, i.label])),
  [settingsItem.to, settingsItem.label],
  ['/tasks', 'Tasks'],
  ['/library', 'Books'],
] as [string, string][])

function Brand() {
  return (
    <div className="flex items-center gap-3 px-2">
      <img src="/pset.svg" alt="" className="size-7" />
      <div className="leading-tight">
        <div className="font-heading text-base font-semibold">PSet</div>
        <div className="text-xs text-sidebar-foreground/60">Study engine</div>
      </div>
    </div>
  )
}

function AppSidebar() {
  const { health } = useHealth()
  const { pathname } = useLocation()

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border">
        <Brand />
      </SidebarHeader>
      <SidebarContent className="gap-5 px-2 py-3">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label} className="p-0">
            <SidebarGroupLabel className="text-[0.65rem] font-medium tracking-[0.12em] text-sidebar-foreground/50 uppercase">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = !item.soon && (item.end ? pathname === item.to : pathname.startsWith(item.to))
                  return (
                    <SidebarMenuItem key={item.to}>
                      {item.soon ? (
                        <SidebarMenuButton
                          disabled
                          aria-disabled="true"
                          tooltip={`${item.label} (soon)`}
                        >
                          <item.icon className="text-sidebar-foreground/40" />
                          <span className="text-sidebar-foreground/50">{item.label}</span>
                          <Badge
                            variant="outline"
                            className="ml-auto border-sidebar-border px-2 text-[0.6rem] font-normal text-sidebar-foreground/50"
                          >
                            soon
                          </Badge>
                        </SidebarMenuButton>
                      ) : (
                        <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                          <NavLink to={item.to} end={item.end}>
                            <item.icon className={cn(isActive && 'text-sidebar-primary')} />
                            <span>{item.label}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      )}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="gap-0 pb-4">
        <TaskCard />
        <SidebarMenu className="mt-2">
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname.startsWith(settingsItem.to)}
              tooltip={settingsItem.label}
            >
              <NavLink to={settingsItem.to}>
                <settingsItem.icon
                  className={cn(pathname.startsWith(settingsItem.to) && 'text-sidebar-primary')}
                />
                <span>{settingsItem.label}</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="mt-2 px-2 text-xs text-sidebar-foreground/50">
          {health ? `v${health.version}` : '…'}
          <span className="mx-2 opacity-40">·</span>
          local
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

export function AppShell() {
  const location = useLocation()
  const section = [...sectionLabels.entries()].find(([path]) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path),
  )?.[1]

  return (
    <TooltipProvider>
      <Toaster position="bottom-right" />
      <SidebarProvider style={{ '--sidebar-width': '18rem' } as CSSProperties}>
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur md:px-8">
            <SidebarTrigger aria-label="Toggle navigation" />
            <h2 className="text-sm font-medium text-muted-foreground">{section}</h2>
            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle />
            </div>
          </header>
          <main className="min-w-0 flex-1">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
