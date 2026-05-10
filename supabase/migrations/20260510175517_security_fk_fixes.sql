-- Migration: security_fk_fixes
-- Corrige 3 problemas encontrados na auditoria de segurança do Supabase:
--
-- 1. order_refunds.order_id sem FK → órfãos silenciosos se pedido deletado
-- 2. order_refunds.created_by sem FK → rastreabilidade perdida se admin deletado
-- 3. wishlists.user_id / product_id sem FK → órfãos acumulam sem cascata
--
-- Todas as constraints são adicionadas com IF NOT EXISTS para idempotência.

-- ── order_refunds ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'order_refunds_order_id_fkey'
      AND table_name = 'order_refunds'
  ) THEN
    ALTER TABLE public.order_refunds
      ADD CONSTRAINT order_refunds_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'order_refunds_created_by_fkey'
      AND table_name = 'order_refunds'
  ) THEN
    ALTER TABLE public.order_refunds
      ADD CONSTRAINT order_refunds_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── wishlists ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'wishlists_user_id_fkey'
      AND table_name = 'wishlists'
  ) THEN
    ALTER TABLE public.wishlists
      ADD CONSTRAINT wishlists_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'wishlists_product_id_fkey'
      AND table_name = 'wishlists'
  ) THEN
    ALTER TABLE public.wishlists
      ADD CONSTRAINT wishlists_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;
END $$;
