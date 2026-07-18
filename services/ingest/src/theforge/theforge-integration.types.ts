export interface TheForgeIntegrationEffective {
  enabled: boolean;
  apiUrl: string | null;
  serviceToken: string | null;
}

export interface TheForgeIntegrationStatus {
  /** Integración registrada y lista para promover chat → Forge. */
  chatPromotionAvailable: boolean;
  /** Modo mock activo (solo dev/tests). */
  mock: boolean;
  /** Integración habilitada en Ajustes (admin). */
  enabled: boolean;
}

export interface TheForgeIntegrationMasked {
  enabled: boolean;
  apiUrl: string | null;
  hasServiceToken: boolean;
  serviceTokenHint: string | null;
  /** Indica si hay THEFORGE_API_URL en env (fallback al guardar). */
  envApiUrlConfigured: boolean;
}

export interface UpdateTheForgeIntegrationDto {
  enabled?: boolean;
  apiUrl?: string | null;
  /** Vacío borra; omitido no cambia. */
  serviceToken?: string | null;
}
