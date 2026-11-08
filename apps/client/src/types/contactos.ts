export interface ContactUser {
  id: string
  nombre: string
  avatarUrl: string | null
}

export interface ContactSearchResult extends ContactUser {
  barrioPontevedra: string | null
}

export interface ContactEntry {
  id: string
  usuario: ContactUser
}

export interface ContactsOverview {
  contactos: ContactEntry[]
  recibidas: ContactEntry[]
  enviadas: ContactEntry[]
}
