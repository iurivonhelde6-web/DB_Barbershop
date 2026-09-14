/// <reference types="vite/client" />

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {PaymentSuccessPage} from './components/PaymentSuccessPage.tsx';
import {PaymentCancelledPage} from './components/PaymentCancelledPage.tsx';
import './index.css';

/**
 * Roteamento mínimo por pathname para as páginas de retorno do Stripe Checkout.
 * Resolvido aqui (fora do App) porque essas rotas são acessadas via navegação
 * completa (redirect do Stripe), não navegação client-side — não há necessidade
 * de um router de verdade, e assim o App continua livre de hooks condicionais.
 */
function resolveRootComponent() {
  switch (window.location.pathname) {
    case '/pagamento-sucesso':
      return <PaymentSuccessPage />;
    case '/pagamento-cancelado':
      return <PaymentCancelledPage />;
    default:
      return <App />;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {resolveRootComponent()}
  </StrictMode>,
);
