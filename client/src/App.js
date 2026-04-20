import './App.css';
import { BrowserRouter, Routes, Route} from 'react-router-dom'
import Home from './components/user/Home';
import Login, { AuthProvider } from './components/user/Login';
import Signup from './components/user/Signup';
import Faqs from './components/user/Faqs';
import HowItWorks from './components/user/HowItWorks';
import Dashboard from './components/user/Dashboard';
import TrainModel from './components/user/TrainModel';
import SavedVideos from './components/user/SavedVideo';
import Profile from './components/user/Profile';
import CompareRuns from './components/user/CompareRuns';
import ActionPlanTasks from './components/user/ActionPlanTasks';


function App() {
  return (
    <div className="App">
      <AuthProvider>
         <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/home" element={<Home />} />
            <Route path="/faqs" element={<Faqs />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/train-model" element={<TrainModel />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/saved-videos" element={<SavedVideos />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/compare-runs" element={<CompareRuns />} />
            <Route path="/action-plan-tasks" element={<ActionPlanTasks />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
