import React, { useEffect, useState } from 'react';
import { getReviewStats, getMe, createCheckoutSession, createPortalSession, syncSubscription } from '../../api/client';
import { useNavigate } from 'react-router-dom';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Navbar } from '../../components/Navbar/Navbar';
import { toast } from 'react-hot-toast';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function Stats() {
  const [stats, setStats] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadDataAndSync() {
      const params = new URLSearchParams(window.location.search);
      const sessionId = params.get("session_id");
      const checkoutSuccess = params.get("checkout_success") === "true";
      const checkoutCancel = params.get("checkout_cancel") === "true";

      setLoading(true);
      try {
        if (checkoutSuccess && sessionId) {
          try {
            await syncSubscription(sessionId);
            toast.success("Félicitations, vous êtes maintenant Premium ! 👑", { id: "stripe_success" });
          } catch (syncErr) {
            toast.error("Erreur de synchronisation de l'abonnement : " + syncErr.message);
          }
          // Remove query params to keep URL clean
          window.history.replaceState({}, document.title, window.location.pathname);
        } else if (checkoutCancel) {
          toast.error("L'abonnement a été annulé.", { id: "stripe_cancel" });
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        const statsData = await getReviewStats();
        setStats(statsData);

        const userData = await getMe();
        setUser(userData);
      } catch (err) {
        setError(err.message || "Erreur lors du chargement des statistiques");
      } finally {
        setLoading(false);
      }
    }
    loadDataAndSync();
  }, []);

  const handleCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const data = await createCheckoutSession();
      window.location.href = data.url;
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handlePortal = async () => {
    setCheckoutLoading(true);
    try {
      const data = await createPortalSession();
      window.location.href = data.url;
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <Navbar />
        <div style={styles.center}>Chargement des statistiques...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <Navbar />
        <div style={{...styles.center, color: '#ef4444'}}>{error}</div>
      </div>
    );
  }

  // Calcul du calendrier GitHub
  const calendarData = stats ? generateCalendarData(stats.daily) : [];
  const calendarWeeks = [];
  for (let i = 0; i < calendarData.length; i += 7) {
    calendarWeeks.push(calendarData.slice(i, i + 7));
  }

  function generateCalendarData(dailyData) {
    const calendar = [];
    const today = new Date();
    // 363 jours + aujourd'hui = 364 jours (52 semaines complètes)
    for (let i = 363; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      const count = dailyData[dateString] || 0;
      calendar.push({
        date: date,
        dateString: dateString,
        count: count
      });
    }
    return calendar;
  }

  // Préparation des données Chart.js
  const weeklyLabels = Object.keys(stats.weekly || {}).map(w => {
    const parts = w.split('-W');
    return parts.length > 1 ? `Sem. ${parts[1]}` : w;
  });

  const weeklyChartData = {
    labels: weeklyLabels,
    datasets: [
      {
        label: 'Révisions',
        data: Object.values(stats.weekly || {}),
        backgroundColor: 'rgba(99, 102, 241, 0.8)',
        borderColor: '#6366f1',
        borderWidth: 1,
        borderRadius: 6,
      }
    ]
  };

  const weeklyOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: { 
        beginAtZero: true, 
        ticks: { stepSize: 1, color: '#94a3b8' },
        grid: { color: '#2d2d2d' }
      },
      x: {
        ticks: { color: '#94a3b8' },
        grid: { display: false }
      }
    }
  };

  const buttonsChartData = {
    labels: ['Je ne sais plus', 'Un peu dur', 'Je sais', 'Trop facile'],
    datasets: [
      {
        data: [
          stats.buttons_month?.[1] || 0,
          stats.buttons_month?.[2] || 0,
          stats.buttons_month?.[3] || 0,
          stats.buttons_month?.[4] || 0
        ],
        backgroundColor: [
          '#ef4444', // Rouge
          '#f97316', // Orange
          '#22c55e', // Vert
          '#3b82f6'  // Bleu
        ],
        borderWidth: 0,
        hoverOffset: 4
      }
    ]
  };

  const buttonsOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        position: 'bottom', 
        labels: { 
          boxWidth: 12, 
          padding: 15, 
          font: { family: 'system-ui' },
          color: '#cbd5e1'
        } 
      }
    }
  };

  const totalReviews = Object.values(stats.daily || {}).reduce((a, b) => a + b, 0);

  const renderPremiumCard = () => {
    if (user?.is_premium) return null; // Hide the card when user is premium
    return (
      <div style={styles.premiumCard}>
        <div style={styles.premiumTextSection}>
          <h3 style={styles.premiumCardTitle}>⚡ Passez à SensAI Premium</h3>
          <p style={styles.premiumCardDesc}>
            Limites actuelles (Mode Gratuit) : 20 analyses / 6h, 5 dossiers max, 15 fiches par dossier. S'abonner pour débloquer l'illimité !
          </p>
        </div>
        <button 
          onClick={handleCheckout} 
          disabled={checkoutLoading} 
          style={styles.btnPremiumUpgrade}
        >
          {checkoutLoading ? "Chargement..." : "👑 S'abonner (9.99€/mois)"}
        </button>
      </div>
    );
  };

  if (totalReviews === 0) {
    return (
      <div style={styles.container}>
        <Navbar />
        <div style={styles.contentWrapper}>
          {renderPremiumCard()}
          
          <div style={styles.emptyStatsContainer}>
            <div style={styles.emptyStatsIcon}>📊</div>
            <h2 style={styles.emptyStatsTitle}>Aucune statistique pour le moment</h2>
            <p style={styles.emptyStatsMessage}>
              Il n'y a pas encore de données d'apprentissage enregistrées.
              Mais rassurez-vous, il n'est pas trop tard pour commencer à apprendre et à réviser vos fiches !
            </p>
            <button onClick={() => navigate('/study')} style={styles.btnStartLearning}>
              🧠 Commencer à réviser
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <Navbar />
      <div style={styles.contentWrapper}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.pageTitle}>📊 Mes Statistiques d'Apprentissage</h1>
            <p style={styles.subTitle}>Suivez vos progrès réguliers et l'évolution de votre mémoire.</p>
          </div>
          <button onClick={() => navigate('/')} style={styles.btnBack}>
            Retour Bibliothèque
          </button>
        </div>

        {renderPremiumCard()}

        {/* Grid des indicateurs clés (Cards) */}
        <div style={styles.statsCardGrid}>
          <div style={styles.statMiniCard}>
            <span style={styles.miniCardTitle}>Total des révisions</span>
            <span style={styles.miniCardValue}>{totalReviews}</span>
          </div>
          <div style={styles.statMiniCard}>
            <span style={styles.miniCardTitle}>Mois en cours</span>
            <span style={styles.miniCardValue}>
              {Object.values(stats.buttons_month || {}).reduce((a, b) => a + b, 0)}
            </span>
          </div>
          <div style={styles.statMiniCard}>
            <span style={styles.miniCardTitle}>Jours actifs</span>
            <span style={styles.miniCardValue}>
              {Object.values(stats.daily || {}).filter(c => c > 0).length} j
            </span>
          </div>
        </div>

        {/* Calendrier de révisions journalières (GitHub Style) */}
        <div style={styles.cardContainer}>
          <h2 style={styles.cardTitle}>📅 Calendrier des révisions journalières</h2>
          <p style={styles.cardDescription}>Historique de vos sessions d'apprentissage sur les 364 derniers jours.</p>
          <div style={styles.calendarWrapper}>
            <div style={styles.calendarGrid}>
              {calendarWeeks.map((week, wIndex) => (
                <div key={wIndex} style={styles.calendarColumn}>
                  {week.map((day) => {
                    let bgColor = '#2d2d2d';
                    if (day.count > 0 && day.count <= 2) bgColor = '#0e4429';
                    else if (day.count > 2 && day.count <= 5) bgColor = '#006d32';
                    else if (day.count > 5 && day.count <= 10) bgColor = '#26a641';
                    else if (day.count > 10) bgColor = '#39d353';

                    return (
                      <div
                        key={day.dateString}
                        style={{ ...styles.calendarCell, backgroundColor: bgColor }}
                        title={`${day.dateString} : ${day.count} révision(s)`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div style={styles.legendContainer}>
            <span style={styles.legendText}>Moins</span>
            <div style={{ ...styles.legendCell, backgroundColor: '#2d2d2d' }} />
            <div style={{ ...styles.legendCell, backgroundColor: '#0e4429' }} />
            <div style={{ ...styles.legendCell, backgroundColor: '#006d32' }} />
            <div style={{ ...styles.legendCell, backgroundColor: '#26a641' }} />
            <div style={{ ...styles.legendCell, backgroundColor: '#39d353' }} />
            <span style={styles.legendText}>Plus</span>
          </div>
        </div>

        {/* Graphiques Section */}
        <div style={styles.chartsGrid}>
          <div style={styles.cardContainer}>
            <h2 style={styles.cardTitle}>📈 Révisions par semaine</h2>
            <p style={styles.cardDescription}>Volume de fiches révisées par semaine (12 dernières semaines).</p>
            <div style={styles.chartWrapper}>
              <Bar data={weeklyChartData} options={weeklyOptions} />
            </div>
          </div>

          <div style={styles.cardContainer}>
            <h2 style={styles.cardTitle}>🍩 Autoévaluation du mois</h2>
            <p style={styles.cardDescription}>Distribution des scores donnés lors de vos révisions ce mois-ci.</p>
            <div style={styles.chartWrapper}>
              <Doughnut data={buttonsChartData} options={buttonsOptions} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#121212',
    color: '#ffffff',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  contentWrapper: {
    padding: '40px 20px',
    maxWidth: '1000px',
    margin: '0 auto',
    width: '100%',
    boxSizing: 'border-box',
    flex: 1,
    display: 'flex',
    flexDirection: 'column'
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    textAlign: 'center',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '1.2rem',
    color: '#94a3b8'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '30px'
  },
  pageTitle: {
    fontSize: '2.25rem',
    fontWeight: '800',
    color: '#f8fafc',
    margin: '0 0 8px 0'
  },
  subTitle: {
    fontSize: '1.05rem',
    color: '#94a3b8',
    margin: 0
  },
  btnBack: {
    padding: '10px 18px',
    background: '#2d2d2d',
    color: '#cbd5e1',
    border: '1px solid #3f3f3f',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.95rem',
    fontWeight: '600',
    transition: 'all 0.2s ease',
    outline: 'none',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
  },
  premiumCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '24px',
    background: 'linear-gradient(135deg, #1e1e1e 0%, #201730 100%)',
    borderRadius: '16px',
    border: '1px solid #3b255e',
    marginBottom: '30px',
    boxShadow: '0 4px 15px rgba(139, 92, 246, 0.1)',
    gap: '20px',
    flexWrap: 'wrap'
  },
  premiumTextSection: {
    flex: 1,
    minWidth: '280px'
  },
  premiumCardTitle: {
    margin: '0 0 8px 0',
    fontSize: '1.4rem',
    fontWeight: '800',
    color: '#e9d5ff',
    background: 'linear-gradient(135deg, #c084fc, #f472b6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent'
  },
  premiumCardDesc: {
    margin: 0,
    fontSize: '0.95rem',
    color: '#cbd5e1',
    lineHeight: '1.5'
  },
  btnPremiumUpgrade: {
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #a855f7, #ec4899)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '700',
    boxShadow: '0 4px 12px rgba(168, 85, 247, 0.2)',
    transition: 'all 0.2s ease',
    outline: 'none'
  },
  btnPremiumManage: {
    padding: '12px 24px',
    background: 'transparent',
    border: '1px solid #8b5cf6',
    color: '#c084fc',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '700',
    transition: 'all 0.2s ease',
    outline: 'none'
  },
  statsCardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '20px',
    marginBottom: '30px'
  },
  statMiniCard: {
    backgroundColor: '#1e1e1e',
    borderRadius: '16px',
    padding: '20px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    border: '1px solid #2d2d2d',
    display: 'flex',
    flexDirection: 'column',
    gap: '5px'
  },
  miniCardTitle: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  miniCardValue: {
    fontSize: '2rem',
    fontWeight: '800',
    color: '#f8fafc'
  },
  cardContainer: {
    backgroundColor: '#1e1e1e',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    border: '1px solid #2d2d2d',
    marginBottom: '30px'
  },
  cardTitle: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: '#f8fafc',
    margin: '0 0 4px 0'
  },
  cardDescription: {
    fontSize: '0.9rem',
    color: '#94a3b8',
    margin: '0 0 20px 0'
  },
  calendarWrapper: {
    overflowX: 'auto',
    width: '100%',
    paddingBottom: '10px'
  },
  calendarGrid: {
    display: 'flex',
    gap: '4px',
    minWidth: '780px'
  },
  calendarColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  calendarCell: {
    width: '11px',
    height: '11px',
    borderRadius: '2px',
    transition: 'transform 0.1s ease',
    cursor: 'pointer'
  },
  legendContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    justifyContent: 'flex-end',
    marginTop: '12px'
  },
  legendText: {
    fontSize: '0.8rem',
    color: '#94a3b8'
  },
  legendCell: {
    width: '11px',
    height: '11px',
    borderRadius: '2px'
  },
  chartsGrid: {
    display: 'grid',
    gridTemplateColumns: '3fr 2fr',
    gap: '30px'
  },
  chartWrapper: {
    height: '280px',
    position: 'relative'
  },
  emptyStatsContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '60px 20px',
    backgroundColor: '#1e1e1e',
    borderRadius: '16px',
    border: '1px solid #2d2d2d',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    marginTop: '40px'
  },
  emptyStatsIcon: {
    fontSize: '4rem',
    marginBottom: '20px'
  },
  emptyStatsTitle: {
    fontSize: '1.75rem',
    fontWeight: '700',
    color: '#f8fafc',
    margin: '0 0 12px 0'
  },
  emptyStatsMessage: {
    fontSize: '1.1rem',
    color: '#94a3b8',
    maxWidth: '500px',
    lineHeight: '1.6',
    margin: '0 0 30px 0'
  },
  btnStartLearning: {
    padding: '12px 24px',
    background: 'linear-gradient(135deg, #27ae60, #219653)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '1.05rem',
    fontWeight: '700',
    boxShadow: '0 4px 12px rgba(39, 174, 96, 0.2)',
    transition: 'all 0.2s ease',
    outline: 'none'
  }
};
