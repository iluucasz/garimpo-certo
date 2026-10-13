import { redirect } from 'next/navigation'

/** O catálogo agora é gerenciado em Produtos; a importação em Importações. */
export default function AdminCatalogRedirect() {
  redirect('/admin/produtos')
}
