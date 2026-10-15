import {Link} from 'react-router-dom'
import logo from '../assets/logo.png'

const NavBar = () => {
  return (
    <div>
      
      <nav className='flex justify-between items-center bg-blue-950 '>
        <div className='flex justify-around items-center'>
        <img src={logo} alt="logo" className='ml-3 justify-around rounded-2xl w-25 h-25 mt-2 mb-2 shadow-2xl' />
          <div className='ml-3'>
            <h1 className='font-bold  text-2xl text-gray-400'>PONTE LA <strong className='text-blue-400'>DIEZ</strong></h1>
            <p className='text-gray-400'>Canchas y Partidos</p>
          </div>       
          
        </div>
        

        <div className='mr-3'>
            <Link className='mr-5 hover:bg-blue-500 border-solid rounded-2xl p-3' to="#">Explorar canchas</Link>
            <Link className='mr-5  hover:bg-blue-500 border-solid rounded-2xl p-3' to="#">Partidos</Link>
            <Link className='mr-5  hover:bg-blue-500 border-solid rounded-2xl p-3' to="#">Mis Reservas</Link>
            <Link className='mr-5  hover:bg-blue-500 border-solid rounded-2xl p-3' to="#">Mensajes</Link>
            <Link className='mr-5' to="#">Perfil</Link>
        </div>
        
      </nav>
    </div>
  )
}

export default NavBar
