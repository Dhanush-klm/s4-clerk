'use client';

import { useEffect, useState, useRef } from 'react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

interface UserStats {
  totalUsers: number;
}

interface Analytics {
  totalUsers: number;
  activeUsers: number;
  signUps: number;
  signIns: number;
  recentSignups: Array<{
    name: string;
    email: string;
    timestamp: string;
  }>;
  recentSignIns: Array<{
    name: string;
    email: string;
    timestamp: string;
  }>;
}

interface EmailStatus {
  email: string;
  found: boolean;
  lastActivity?: {
    type: 'signin' | 'signup';
    timestamp: string;
  };
}

export default function Dashboard() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'signups' | 'signins'>('signins');
  const [emailStatuses, setEmailStatuses] = useState<EmailStatus[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchStats();
    fetchAnalytics();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/user-stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/analytics');
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    const fileType = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls'].includes(fileType || '')) {
      setError('Please upload only Excel files (.xlsx or .xls)');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setFileName(file.name);
    setProcessing(true);
    setEmailStatuses([]);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      
      if (workbook.SheetNames.length === 0) {
        throw new Error('The Excel file is empty');
      }

      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length <= 1) {
        throw new Error('The Excel file contains no data or only headers');
      }

      // Extract emails from the first column
      const emails = jsonData
        .slice(1) // Skip header row
        .map((row: any) => row[0])
        .filter((email: string) => email && typeof email === 'string');

      if (emails.length === 0) {
        throw new Error('No valid email addresses found in the first column');
      }

      // Cross-reference with analytics data
      const statuses = emails.map((email: string) => {
        const signupEntry = analytics?.recentSignups.find(u => u.email === email);
        const signinEntry = analytics?.recentSignIns.find(u => u.email === email);

        let lastActivity;
        if (signupEntry && signinEntry) {
          const signupDate = new Date(signupEntry.timestamp);
          const signinDate = new Date(signinEntry.timestamp);
          lastActivity = signinDate > signupDate 
            ? { type: 'signin' as const, timestamp: signinEntry.timestamp }
            : { type: 'signup' as const, timestamp: signupEntry.timestamp };
        } else if (signupEntry) {
          lastActivity = { type: 'signup' as const, timestamp: signupEntry.timestamp };
        } else if (signinEntry) {
          lastActivity = { type: 'signin' as const, timestamp: signinEntry.timestamp };
        }

        return {
          email,
          found: !!(signupEntry || signinEntry),
          lastActivity
        };
      });

      setEmailStatuses(statuses);
    } catch (error) {
      console.error('Error processing file:', error);
      setError(error instanceof Error ? error.message : 'Error processing the Excel file');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } finally {
      setProcessing(false);
    }
  };

  const resetUpload = () => {
    setEmailStatuses([]);
    setFileName(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">User Analytics Dashboard</h1>
        
        {/* Excel Upload Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Upload Excel File</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="relative cursor-pointer bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition-colors">
                <span>{fileName ? 'Choose Another File' : 'Choose Excel File'}</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={processing}
                />
              </label>
              {processing && (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500"></div>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Processing file...</span>
                </div>
              )}
              {fileName && !processing && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    Current file: {fileName}
                  </span>
                  <button
                    onClick={resetUpload}
                    className="text-red-500 hover:text-red-600 text-sm"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
            {error && (
              <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                {error}
              </div>
            )}
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <p>Instructions:</p>
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li>Upload an Excel file (.xlsx or .xls)</li>
                <li>Ensure email addresses are in the first column (Column A)</li>
                <li>First row should be the header row</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Email Status Results */}
        {emailStatuses.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Email Status Results</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Activity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date & Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {emailStatuses.map((status, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {status.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          status.found
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {status.found ? 'Found' : 'Not Found'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {status.lastActivity?.type === 'signin' ? 'Sign In' : status.lastActivity?.type === 'signup' ? 'Sign Up' : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {status.lastActivity 
                          ? format(new Date(status.lastActivity.timestamp), 'MMM d, yyyy h:mm a')
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Users</h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{stats?.totalUsers || 0}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Users</h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{analytics?.activeUsers || 0}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">New Signups</h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{analytics?.signUps || 0}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Sign Ins</h3>
            <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{analytics?.signIns || 0}</p>
          </div>
        </div>

        {/* Activity Section with Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('signins')}
                className={`${
                  activeTab === 'signins'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm`}
              >
                Sign Ins
              </button>
              <button
                onClick={() => setActiveTab('signups')}
                className={`${
                  activeTab === 'signups'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                } whitespace-nowrap py-4 px-6 border-b-2 font-medium text-sm`}
              >
                Sign Ups
              </button>
            </nav>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {(activeTab === 'signins' ? analytics?.recentSignIns : analytics?.recentSignups)?.map((user, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{user.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{user.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {format(new Date(user.timestamp), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {format(new Date(user.timestamp), 'h:mm a')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          activeTab === 'signins' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        }`}>
                          {activeTab === 'signins' ? 'Signed In' : 'Signed Up'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
