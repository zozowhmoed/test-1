import { Link } from 'react-router-dom';

function HomePage() {
  return (
    <div className="home-container">
      {/* محتوى الصفحة الرئيسية */}
      
      <Link to="/profile" className="profile-link">
        الذهاب إلى الصفحة الشخصية
      </Link>
    </div>
  );
}

export default HomePage;