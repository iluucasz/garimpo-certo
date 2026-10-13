/**
 * O login com o Google só existe quando as duas credenciais estão configuradas.
 * `NEXT_PUBLIC_GOOGLE_LOGIN` é calculada em next.config.mjs a partir delas (apenas '1' ou vazio),
 * o que permite usar a mesma checagem em componentes de servidor e de cliente.
 */
export function googleEnabled() {
  return process.env.NEXT_PUBLIC_GOOGLE_LOGIN === '1'
}
