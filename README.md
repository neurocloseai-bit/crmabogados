# Despacho CRM

CRM para despachos de abogados: leads (pipeline), clientes, expedientes, agenda de términos con cómputo de días hábiles, cobranza con planes de pago y biblioteca de documentos. Multi-despacho: cada despacho ve solo sus datos (seguridad por fila en Postgres).

Stack: React + Vite + TypeScript + Tailwind, Supabase (Auth, Postgres, Storage), deploy en Vercel.

## 1. Base de datos (Supabase)
1. Crea un proyecto en supabase.com.
2. SQL Editor: pega todo `supabase/migrations/0001_init.sql` y ejecútalo.
3. Authentication > Providers: Email activo. Para probar rápido puedes desactivar "Confirm email".
4. Project Settings > API: copia la URL y la clave `anon` / publishable.

## 2. Correr local
```bash
cp .env.example .env     # pega URL y clave
npm install
npm run dev
```
Crea tu cuenta en la pantalla de inicio y luego tu despacho.

## 3. Publicar en Vercel
1. Sube la carpeta a un repositorio de GitHub e impórtalo en Vercel (framework: Vite).
2. En Settings > Environment Variables agrega `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. En Supabase > Authentication > URL Configuration, pon la URL de Vercel como Site URL.

## Pendiente para venderlo
- Invitar compañeros al despacho (hoy cada cuenta crea su propio despacho).
- Planes de suscripción y cobro (Stripe), rol de solo lectura, auditoría de cambios.
- Avisos de términos por WhatsApp o correo (Edge Function + cron).
- Modo oscuro, exportar a Excel.
- Aviso de privacidad y términos de uso revisados por un abogado antes de cobrar.
