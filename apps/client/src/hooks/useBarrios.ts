import { useEffect, useState } from 'react'
import { usersService } from '../services/users.service'

export const useBarrios = () => {
  const [barrios, setBarrios] = useState<string[]>([])

  useEffect(() => {
    let active = true
    usersService
      .barrios()
      .then((list) => active && setBarrios(list))
      .catch(() => active && setBarrios([]))
    return () => {
      active = false
    }
  }, [])

  return barrios
}
