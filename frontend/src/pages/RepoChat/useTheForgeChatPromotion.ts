import { useEffect, useState } from 'react';
import { api } from '@/api';

/** ¿Integración The Forge activa para promover chat? (false por defecto en OSS sin configurar). */
export function useTheForgeChatPromotion() {
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getTheForgeIntegrationStatus()
      .then((status) => {
        if (!cancelled) setAvailable(status.chatPromotionAvailable);
      })
      .catch(() => {
        if (!cancelled) setAvailable(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { available, loading };
}
