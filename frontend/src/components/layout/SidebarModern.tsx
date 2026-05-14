/**
 * Sidebar lateral — estilo tipo panel SaaS: cabecera con colapsar, divisores,
 * activo con barra + tinte, duotone en iconos, submenús con guía vertical.
 */
import { useState, forwardRef } from "react"
import { Link, useLocation } from "react-router-dom"
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import type { Icon } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { AriadneLogo } from "@/components/brand/AriadneLogo"

export interface SidebarLink {
  label: string
  href: string
  icon: Icon
  badge?: string
  children?: { label: string; href: string }[]
}

export interface SidebarGroup {
  title?: string
  items: SidebarLink[]
}

export interface SidebarModernProps {
  groups: SidebarGroup[]
  activeHref?: string
  collapsible?: boolean
  defaultCollapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  brand?: React.ReactNode
  /** Links fijos al pie (p. ej. Configuración, Ayuda). */
  footerItems?: SidebarLink[]
  className?: string
}

function isRouteActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/"
  if (href === "/ayuda") return pathname.startsWith("/ayuda")
  if (href === "/settings") return pathname.startsWith("/settings")
  return pathname.startsWith(href)
}

/**
 * Collapsed rail (icon-only): one circular hit target for toggle + every nav icon.
 * Active: solid brand primary (purple) + white icon.
 */
const RAIL_COLLAPSED_HIT =
  "mx-auto flex size-10 shrink-0 items-center justify-center rounded-full touch-manipulation transition-colors duration-150"

const RAIL_COLLAPSED_FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]"

const RAIL_COLLAPSED_IDLE = cn(
  RAIL_COLLAPSED_HIT,
  RAIL_COLLAPSED_FOCUS,
  "text-[var(--foreground-muted)] hover:bg-[color-mix(in_oklch,var(--foreground)_4%,var(--card))] hover:text-[var(--foreground)]",
)

const RAIL_COLLAPSED_ACTIVE = cn(
  RAIL_COLLAPSED_HIT,
  RAIL_COLLAPSED_FOCUS,
  "bg-[var(--primary)] text-white",
)

type SidebarLeafLinkRowProps = {
  item: SidebarLink
  collapsed: boolean
  pathname: string
  activeHref?: string
}

/** Single leaf nav row (no submenu) — shared by main list and footer. */
function SidebarLeafLinkRow({
  item,
  collapsed,
  pathname,
  activeHref,
}: SidebarLeafLinkRowProps) {
  const active = activeHref ? activeHref === item.href : isRouteActive(pathname, item.href)
  const Icon = item.icon
  const leafHighlighted = active
  const barVisible = leafHighlighted

  const navRowClass = cn(
    "group relative flex cursor-pointer items-center transition-colors duration-150",
    collapsed
      ? cn("justify-center", leafHighlighted ? RAIL_COLLAPSED_ACTIVE : RAIL_COLLAPSED_IDLE)
      : cn(
          "gap-3 rounded-xl px-3 py-2.5",
          leafHighlighted &&
            "bg-[color-mix(in_oklch,var(--primary)_14%,transparent)] text-[var(--primary)]",
          !leafHighlighted &&
            "text-[var(--foreground-muted)] hover:bg-[var(--muted)]/70 hover:text-[var(--foreground)]",
        ),
  )

  const NavItemContent = (
    <div className={navRowClass}>
      {!collapsed ? (
        <span
          className={cn(
            "absolute left-0 top-1/2 h-[60%] w-[3px] -translate-y-1/2 rounded-full bg-[var(--primary)] transition-opacity duration-150",
            barVisible ? "opacity-100" : "opacity-0",
          )}
          aria-hidden
        />
      ) : null}
      <Icon
        weight="duotone"
        size={20}
        className={cn(
          "relative shrink-0",
          leafHighlighted
            ? collapsed
              ? "text-white"
              : "text-[var(--primary)]"
            : "text-[var(--foreground-subtle)] group-hover:text-[var(--primary)]",
        )}
        aria-hidden
      />
      {!collapsed ? (
        <>
          <span
            className={cn(
              "relative min-w-0 flex-1 truncate text-sm font-medium",
              leafHighlighted && "text-[var(--primary)]",
            )}
          >
            {item.label}
          </span>
          {item.badge ? (
            <span
              className={cn(
                "relative shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                "bg-emerald-500/15 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300",
                leafHighlighted &&
                  "bg-emerald-600/20 text-emerald-900 dark:bg-emerald-400/25 dark:text-emerald-200",
              )}
            >
              {item.badge}
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  )

  return collapsed ? (
    <Link to={item.href} title={item.label} className="flex justify-center">
      {NavItemContent}
    </Link>
  ) : (
    <Link to={item.href}>{NavItemContent}</Link>
  )
}

export const SidebarModern = forwardRef<HTMLElement, SidebarModernProps>(
  (
    {
      groups,
      activeHref,
      collapsible = true,
      defaultCollapsed = false,
      onCollapsedChange,
      brand,
      footerItems,
      className,
    },
    ref
  ) => {
    const [collapsed, setCollapsed] = useState(defaultCollapsed)
    const [openMenus, setOpenMenus] = useState<string[]>([])
    const location = useLocation()

    const toggleCollapse = () => {
      const newState = !collapsed
      setCollapsed(newState)
      onCollapsedChange?.(newState)
    }

    const toggleSubmenu = (label: string) => {
      if (collapsed) return
      setOpenMenus((prev) =>
        prev.includes(label) ? prev.filter((i) => i !== label) : [...prev, label]
      )
    }

    const isActive = (href: string) => {
      if (activeHref) return activeHref === href
      return isRouteActive(location.pathname, href)
    }

    return (
      <aside
        ref={ref}
        className={cn(
          "relative z-[var(--z-fixed)] flex h-full min-h-0 flex-col border-r border-[var(--border)] bg-[var(--card)] pb-[env(safe-area-inset-bottom,0px)] transition-[width] duration-300 ease-in-out",
          collapsed ? "w-20" : "w-72",
          className
        )}
      >
        <div className="shrink-0 border-b border-[var(--border)] pt-[env(safe-area-inset-top,0px)]">
          <div
            className={cn(
              "flex h-16 w-full shrink-0 items-center px-2",
              collapsed ? "justify-center" : "gap-2",
            )}
          >
            <div
              className={cn(
                "flex min-w-0 select-none items-center gap-2 py-1.5 pl-1 pr-1",
                collapsed ? "justify-center" : "flex-1",
              )}
            >
              {collapsed ? (
                <AriadneLogo variant="mark" className="shrink-0" />
              ) : (
                <>
                  <AriadneLogo variant="compact" className="max-w-[min(100%,8rem)]" />
                  {brand ? (
                    <span className="min-w-0 truncate text-sm font-medium text-[var(--foreground-muted)]">
                      {brand}
                    </span>
                  ) : null}
                </>
              )}
            </div>
            {collapsible && !collapsed ? (
              <button
                type="button"
                onClick={toggleCollapse}
                className={cn(
                  "flex size-9 shrink-0 touch-manipulation items-center justify-center rounded-md",
                  "text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card)]",
                )}
                aria-label="Colapsar barra lateral"
              >
                <PanelLeftClose className="size-5" strokeWidth={1.75} aria-hidden />
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto py-3">
          {collapsible && collapsed ? (
            <div className="flex justify-center px-2 pb-2">
              <button
                type="button"
                onClick={toggleCollapse}
                className={RAIL_COLLAPSED_IDLE}
                aria-label="Expandir barra lateral"
              >
                <PanelLeftOpen className="size-5" strokeWidth={1.75} aria-hidden />
              </button>
            </div>
          ) : null}
          {groups.map((group, idx) => (
            <div key={idx} className="px-2">
              {idx > 0 ? (
                <div
                  className="mx-3 mb-3 mt-2 h-px shrink-0 bg-[var(--border)]"
                  aria-hidden
                  role="separator"
                />
              ) : null}
              {!collapsed && group.title ? (
                <h3 className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--foreground-subtle)]">
                  {group.title}
                </h3>
              ) : null}

              <div className="space-y-0.5">
                {group.items.map((item, i) => {
                  const active = isActive(item.href)
                  const Icon = item.icon
                  const hasChildren = Boolean(item.children?.length)
                  const isMenuOpen = openMenus.includes(item.label)
                  const childActive = Boolean(
                    item.children?.some((c) => isRouteActive(location.pathname, c.href)),
                  )

                  const leafHighlighted = !hasChildren && active
                  const parentHighlighted =
                    hasChildren && (childActive || isMenuOpen)
                  const barVisible = leafHighlighted || (hasChildren && childActive)

                  const collapsedRailActive =
                    collapsed &&
                    (leafHighlighted || (hasChildren && childActive))

                  const navRowClass = cn(
                    "group relative flex cursor-pointer items-center transition-colors duration-150",
                    collapsed
                      ? cn(
                          "justify-center",
                          collapsedRailActive ? RAIL_COLLAPSED_ACTIVE : RAIL_COLLAPSED_IDLE,
                        )
                      : cn(
                          "gap-3 rounded-xl px-3 py-2.5",
                          leafHighlighted &&
                            "bg-[color-mix(in_oklch,var(--primary)_14%,transparent)] text-[var(--primary)]",
                          !leafHighlighted &&
                            parentHighlighted &&
                            "bg-[color-mix(in_oklch,var(--primary)_8%,transparent)] text-[var(--foreground)]",
                          !leafHighlighted &&
                            !parentHighlighted &&
                            "text-[var(--foreground-muted)] hover:bg-[var(--muted)]/70 hover:text-[var(--foreground)]",
                        ),
                  )

                  const barClass = barVisible ? "opacity-100" : "opacity-0"

                  const collapsedActiveIcon =
                    collapsed && (leafHighlighted || (hasChildren && childActive))

                  const NavItemContent = (
                    <div
                      role={hasChildren ? "button" : undefined}
                      tabIndex={hasChildren ? 0 : undefined}
                      onClick={() => (hasChildren ? toggleSubmenu(item.label) : undefined)}
                      onKeyDown={(e) => {
                        if (!hasChildren) return
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          toggleSubmenu(item.label)
                        }
                      }}
                      className={cn(navRowClass, hasChildren && "select-none")}
                    >
                      {!collapsed ? (
                        <span
                          className={cn(
                            "absolute left-0 top-1/2 h-[60%] w-[3px] -translate-y-1/2 rounded-full bg-[var(--primary)] transition-opacity duration-150",
                            barClass,
                          )}
                          aria-hidden
                        />
                      ) : null}
                      <Icon
                        weight="duotone"
                        size={20}
                        className={cn(
                          "relative shrink-0",
                          collapsedActiveIcon
                            ? "text-white"
                            : leafHighlighted || (hasChildren && childActive)
                              ? "text-[var(--primary)]"
                              : "text-[var(--foreground-subtle)] group-hover:text-[var(--primary)]",
                        )}
                        aria-hidden
                      />
                      {!collapsed ? (
                        <>
                          <span
                            className={cn(
                              "relative min-w-0 flex-1 truncate text-sm font-medium",
                              leafHighlighted && "text-[var(--primary)]",
                            )}
                          >
                            {item.label}
                          </span>
                          {item.badge ? (
                            <span
                              className={cn(
                                "relative shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                                "bg-emerald-500/15 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300",
                                leafHighlighted &&
                                  "bg-emerald-600/20 text-emerald-900 dark:bg-emerald-400/25 dark:text-emerald-200",
                              )}
                            >
                              {item.badge}
                            </span>
                          ) : null}
                          {hasChildren ? (
                            <ChevronDown
                              className={cn(
                                "relative size-4 shrink-0 text-[var(--foreground-subtle)] transition-transform duration-200",
                                isMenuOpen && "rotate-180"
                              )}
                              aria-hidden
                            />
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  )

                  return (
                    <div key={i}>
                      {hasChildren ? (
                        <div className={collapsed ? "flex justify-center" : undefined}>{NavItemContent}</div>
                      ) : collapsed ? (
                        <Link to={item.href} title={item.label} className="flex justify-center">
                          {NavItemContent}
                        </Link>
                      ) : (
                        <Link to={item.href}>{NavItemContent}</Link>
                      )}

                      {!collapsed && hasChildren && isMenuOpen && item.children ? (
                        <div className="relative ml-4 mt-1 border-l border-[var(--border)] pl-3">
                          {item.children.map((child, j) => {
                            const cActive = isRouteActive(location.pathname, child.href)
                            return (
                              <Link
                                key={j}
                                to={child.href}
                                className={cn(
                                  "relative block rounded-lg py-2 pl-3 pr-2 text-sm transition-colors",
                                  cActive
                                    ? "font-medium text-[var(--primary)]"
                                    : "text-[var(--foreground-muted)] hover:bg-[var(--muted)]/60 hover:text-[var(--foreground)]"
                                )}
                              >
                                {cActive ? (
                                  <span
                                    className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[var(--primary)]"
                                    aria-hidden
                                  />
                                ) : null}
                                <span className="relative pl-1">{child.label}</span>
                              </Link>
                            )
                          })}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        {footerItems && footerItems.length > 0 ? (
          <div className="mt-auto shrink-0">
            <div className="space-y-0.5 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-2">
              {footerItems.map((item, i) => (
                <SidebarLeafLinkRow
                  key={`${item.href}-${i}`}
                  item={item}
                  collapsed={collapsed}
                  pathname={location.pathname}
                  activeHref={activeHref}
                />
              ))}
            </div>
          </div>
        ) : null}
        </div>
      </aside>
    )
  }
)
SidebarModern.displayName = "SidebarModern"
