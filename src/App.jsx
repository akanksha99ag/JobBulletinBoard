import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./styles.css";
import jobsData from "./jobsData";
import JobCard from "./JobCard";
import JobModal from "./JobModal";

const regions = [
  "All Regions",
  "North America",
  "Europe",
  "Asia",
  "Middle East",
  "Remote",
];

const categories = ["All", "Gaming", "Architecture"];
const sources = [
  "All Sources",
  "LinkedIn",
  "Company Website",
  "Indeed",
  "Archinect",
];
const sortOptions = ["Newest", "Oldest", "A-Z", "Source"];
const JOBS_PER_PAGE = 6;

function buildMapGroups(filteredJobs) {
  const grouped = {};

  filteredJobs
    .filter((job) => typeof job.lat === "number" && typeof job.lng === "number")
    .forEach((job) => {
      const key = `${job.city}-${job.country}`;

      if (!grouped[key]) {
        grouped[key] = {
          key,
          city: job.city,
          country: job.country,
          region: job.region,
          lat: job.lat,
          lng: job.lng,
          categories: new Set(),
          companies: {},
        };
      }

      grouped[key].categories.add(job.category);

      if (!grouped[key].companies[job.company]) {
        grouped[key].companies[job.company] = [];
      }

      grouped[key].companies[job.company].push(job);
    });

  return Object.values(grouped).map((group) => ({
    ...group,
    categories: Array.from(group.categories),
  }));
}

function getMarkerVisual(zoom, companyCount, categories, isSelected) {
  const isMixed = categories.length > 1;
  const primaryCategory = isMixed ? "Mixed" : categories[0] || "Mixed";

  const sizesByZoom = {
    2: 36,
    3: 34,
    4: 32,
    5: 30,
    6: 28,
    7: 26,
    8: 24,
  };

  const size = sizesByZoom[Math.round(zoom)] || 30;
  const badgeSize = size < 28 ? 16 : 18;
  const showCityLabel = zoom >= 4;

  return {
    size,
    badgeSize,
    showCityLabel,
    primaryCategory,
    isSelected,
  };
}

function createAdaptiveMarkerIcon(group, zoom, isSelected = false) {
  const companyCount = Object.keys(group.companies).length;
  const visual = getMarkerVisual(
    zoom,
    companyCount,
    group.categories,
    isSelected
  );

  return L.divIcon({
    className: "adaptive-marker-wrapper",
    html: `
      <div 
        class="adaptive-marker adaptive-marker-${visual.primaryCategory
          .toLowerCase()
          .replace(/\s+/g, "-")} ${
      visual.isSelected ? "adaptive-marker-selected" : ""
    }"
        style="width:${visual.size}px;height:${visual.size}px;"
      >
        <span class="adaptive-marker-pulse"></span>
        <span class="adaptive-marker-core"></span>
        <span 
          class="adaptive-marker-badge"
          style="min-width:${visual.badgeSize}px;height:${visual.badgeSize}px;"
        >
          ${companyCount}
        </span>
        ${
          visual.showCityLabel
            ? `<span class="adaptive-marker-label">${group.city}</span>`
            : ""
        }
      </div>
    `,
    iconSize: [visual.size, visual.size],
    iconAnchor: [visual.size / 2, visual.size / 2],
  });
}

function MapExplorerModal({
  isOpen,
  onClose,
  mapGroups,
  remoteOnlyCount,
  selectedMapGroup,
  setSelectedMapGroup,
  selectedCompany,
  setSelectedCompany,
  companyJobsInMap,
  isSaved,
  toggleSaveJob,
  openJobDetails,
}) {
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const markerLayerRef = useRef(null);
  const zoomControlRef = useRef(null);
  const layerControlRef = useRef(null);

  const redrawMarkers = () => {
    if (!mapRef.current || !markerLayerRef.current) return;

    const currentZoom = mapRef.current.getZoom();
    markerLayerRef.current.clearLayers();

    mapGroups.forEach((group) => {
      const companyNames = Object.keys(group.companies);
      const jobsCount = Object.values(group.companies).flat().length;
      const isSelected = selectedMapGroup?.key === group.key;

      const marker = L.marker([group.lat, group.lng], {
        icon: createAdaptiveMarkerIcon(group, currentZoom, isSelected),
        keyboard: true,
      });

      marker.bindTooltip(
        `${group.city}, ${group.country} • ${companyNames.length} companies • ${jobsCount} jobs`,
        {
          direction: "top",
          offset: [0, -16],
          className: "custom-map-tooltip",
        }
      );

      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        setSelectedMapGroup(group);
        setSelectedCompany(null);
      });

      marker.addTo(markerLayerRef.current);
    });
  };

  useEffect(() => {
    if (!isOpen || !mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [20, 5],
      zoom: 2,
      minZoom: 2,
      maxZoom: 8,
      zoomControl: false,
      worldCopyJump: true,
    });

    const darkLayer = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
      {
        subdomains: "abcd",
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors, &copy; CARTO",
      }
    );

    const darkLabels = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png",
      {
        subdomains: "abcd",
        maxZoom: 19,
        pane: "overlayPane",
        attribution: "&copy; OpenStreetMap contributors, &copy; CARTO",
      }
    );

    const lightLayer = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
      {
        subdomains: "abcd",
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors, &copy; CARTO",
      }
    );

    const lightLabels = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png",
      {
        subdomains: "abcd",
        maxZoom: 19,
        pane: "overlayPane",
        attribution: "&copy; OpenStreetMap contributors, &copy; CARTO",
      }
    );

    const streetLayer = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }
    );

    darkLayer.addTo(map);
    darkLabels.addTo(map);

    const baseLayers = {
      Dark: L.layerGroup([darkLayer, darkLabels]),
      Light: L.layerGroup([lightLayer, lightLabels]),
      Street: streetLayer,
    };

    layerControlRef.current = L.control.layers(baseLayers, null, {
      position: "bottomleft",
      collapsed: false,
    });
    layerControlRef.current.addTo(map);

    zoomControlRef.current = L.control
      .zoom({ position: "topright" })
      .addTo(map);

    markerLayerRef.current = L.layerGroup().addTo(map);

    map.on("click", () => {
      setSelectedMapGroup(null);
      setSelectedCompany(null);
    });

    map.on("zoomend", redrawMarkers);
    map.on("moveend", redrawMarkers);

    mapRef.current = map;

    setTimeout(() => {
      map.invalidateSize();
      redrawMarkers();
    }, 150);

    return () => {
      map.off("zoomend", redrawMarkers);
      map.off("moveend", redrawMarkers);
      map.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      zoomControlRef.current = null;
      layerControlRef.current = null;
    };
  }, [isOpen]);

  useEffect(() => {
    redrawMarkers();
  }, [mapGroups, selectedMapGroup]);

  useEffect(() => {
    if (!mapRef.current || !selectedMapGroup) return;

    mapRef.current.flyTo(
      [selectedMapGroup.lat, selectedMapGroup.lng],
      Math.max(mapRef.current.getZoom(), 4),
      { duration: 0.7 }
    );
  }, [selectedMapGroup]);

  const zoomIn = () => {
    if (mapRef.current) mapRef.current.zoomIn();
  };

  const zoomOut = () => {
    if (mapRef.current) mapRef.current.zoomOut();
  };

  const resetView = () => {
    if (mapRef.current) {
      mapRef.current.setView([20, 5], 2);
      setSelectedMapGroup(null);
      setSelectedCompany(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="map-modal-overlay">
      <div className="map-modal-shell">
        <div className="map-modal-topbar">
          <div>
            <h2>Map View</h2>
            <p>Markers now adapt as you zoom in and out.</p>
          </div>

          <div className="map-toolbar">
            <button className="map-tool-btn" onClick={zoomOut}>
              −
            </button>
            <button className="map-tool-btn" onClick={zoomIn}>
              +
            </button>
            <button className="map-tool-btn" onClick={resetView}>
              Reset
            </button>
            <button className="map-tool-btn close-map-btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="map-layout">
          <div className="map-canvas-panel">
            <div ref={mapContainerRef} className="leaflet-map-container" />

            <div className="map-legend">
              <div className="map-legend-item">
                <span className="legend-dot legend-dot-gaming" />
                <span>Gaming</span>
              </div>
              <div className="map-legend-item">
                <span className="legend-dot legend-dot-architecture" />
                <span>Architecture</span>
              </div>
              <div className="map-legend-item">
                <span className="legend-dot legend-dot-mixed" />
                <span>Mixed city</span>
              </div>
            </div>

            {selectedMapGroup && (
              <div className="map-popup-card">
                <h3>
                  {selectedMapGroup.city}, {selectedMapGroup.country}
                </h3>
                <p>
                  {Object.keys(selectedMapGroup.companies).length} companies •{" "}
                  {Object.values(selectedMapGroup.companies).flat().length} jobs
                </p>

                <div className="map-company-grid">
                  {Object.keys(selectedMapGroup.companies).map((company) => (
                    <button
                      key={company}
                      className={`company-chip ${
                        selectedCompany === company ? "company-chip-active" : ""
                      }`}
                      onClick={() => setSelectedCompany(company)}
                    >
                      {company}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="map-side-panel">
            {!selectedMapGroup && (
              <div className="map-side-empty">
                <h3>Select a location</h3>
                <p>Click a marker to see companies and jobs in that city.</p>
                {remoteOnlyCount > 0 && (
                  <div className="remote-note">
                    {remoteOnlyCount} remote-only opportunities are not shown on
                    the map.
                  </div>
                )}
              </div>
            )}

            {selectedMapGroup && !selectedCompany && (
              <div className="map-side-empty">
                <h3>
                  {selectedMapGroup.city}, {selectedMapGroup.country}
                </h3>
                <p>Select a company from the floating card to view its jobs.</p>
              </div>
            )}

            {selectedMapGroup && selectedCompany && (
              <div className="company-profile-panel">
                <div className="company-hero-banner" />
                <div className="company-profile-body">
                  <div className="company-logo-box">
                    {selectedCompany.slice(0, 1)}
                  </div>

                  <h3>{selectedCompany}</h3>
                  <p className="company-profile-text">
                    Explore openings for {selectedCompany} in{" "}
                    {selectedMapGroup.city}, {selectedMapGroup.country}.
                  </p>

                  <div className="company-meta-tags">
                    <span>{selectedMapGroup.region}</span>
                    <span>{companyJobsInMap.length} jobs</span>
                    <span>{selectedMapGroup.city}</span>
                  </div>

                  <div className="company-job-list">
                    {companyJobsInMap.length === 0 ? (
                      <p className="empty-text">
                        No jobs found for this company.
                      </p>
                    ) : (
                      companyJobsInMap.map((job) => (
                        <div key={job.id} className="company-job-item">
                          <div>
                            <strong>{job.title}</strong>
                            <p>
                              {job.jobType} • {job.workMode} • {job.source}
                            </p>
                          </div>

                          <div className="company-job-actions">
                            <button
                              className="mini-action-btn"
                              onClick={() => openJobDetails(job)}
                            >
                              Details
                            </button>
                            <button
                              className={`mini-action-btn ${
                                isSaved(job.id) ? "mini-action-btn-saved" : ""
                              }`}
                              onClick={() => toggleSaveJob(job)}
                            >
                              {isSaved(job.id) ? "Saved" : "Save"}
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [region, setRegion] = useState("All Regions");
  const [source, setSource] = useState("All Sources");
  const [sortBy, setSortBy] = useState("Newest");

  const [selectedJob, setSelectedJob] = useState(null);
  const [showLeaveNotice, setShowLeaveNotice] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [compareJobs, setCompareJobs] = useState([]);

  const [savedJobs, setSavedJobs] = useState(() => {
    try {
      const stored = localStorage.getItem("savedJobsOpenSource");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const stored = localStorage.getItem("recentSearchesOpenSource");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [analytics, setAnalytics] = useState(() => {
    try {
      const stored = localStorage.getItem("jobAnalyticsOpenSource");
      return stored
        ? JSON.parse(stored)
        : { detailViews: 0, applyClicks: 0, savedCount: 0 };
    } catch {
      return { detailViews: 0, applyClicks: 0, savedCount: 0 };
    }
  });

  const [isMapOpen, setIsMapOpen] = useState(false);
  const [selectedMapGroup, setSelectedMapGroup] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      setJobs(jobsData);
      setLoading(false);
    }, 350);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem("savedJobsOpenSource", JSON.stringify(savedJobs));
  }, [savedJobs]);

  useEffect(() => {
    localStorage.setItem(
      "recentSearchesOpenSource",
      JSON.stringify(recentSearches)
    );
  }, [recentSearches]);

  useEffect(() => {
    localStorage.setItem(
      "jobAnalyticsOpenSource",
      JSON.stringify({
        ...analytics,
        savedCount: savedJobs.length,
      })
    );
  }, [analytics, savedJobs]);

  useEffect(() => {
    setAnalytics((prev) => ({
      ...prev,
      savedCount: savedJobs.length,
    }));
  }, [savedJobs]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, category, region, source, sortBy]);

  const filteredJobs = useMemo(() => {
    const result = jobs.filter((job) => {
      const searchText = search.trim().toLowerCase();

      const matchesSearch =
        !searchText ||
        job.title.toLowerCase().includes(searchText) ||
        job.company.toLowerCase().includes(searchText) ||
        job.location.toLowerCase().includes(searchText) ||
        job.country.toLowerCase().includes(searchText) ||
        job.source.toLowerCase().includes(searchText);

      const matchesCategory = category === "All" || job.category === category;
      const matchesRegion = region === "All Regions" || job.region === region;
      const matchesSource = source === "All Sources" || job.source === source;

      return matchesSearch && matchesCategory && matchesRegion && matchesSource;
    });

    const sorted = [...result];

    if (sortBy === "Newest") {
      sorted.sort((a, b) => a.postedDays - b.postedDays);
    } else if (sortBy === "Oldest") {
      sorted.sort((a, b) => b.postedDays - a.postedDays);
    } else if (sortBy === "A-Z") {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === "Source") {
      sorted.sort((a, b) => a.source.localeCompare(b.source));
    }

    return sorted;
  }, [jobs, search, category, region, source, sortBy]);

  const mapGroups = useMemo(() => buildMapGroups(filteredJobs), [filteredJobs]);

  const remoteOnlyCount = useMemo(() => {
    return filteredJobs.filter(
      (job) => typeof job.lat !== "number" || typeof job.lng !== "number"
    ).length;
  }, [filteredJobs]);

  const companyJobsInMap = useMemo(() => {
    if (!selectedMapGroup || !selectedCompany) return [];
    return selectedMapGroup.companies[selectedCompany] || [];
  }, [selectedMapGroup, selectedCompany]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredJobs.length / JOBS_PER_PAGE)
  );
  const startIndex = (currentPage - 1) * JOBS_PER_PAGE;
  const paginatedJobs = filteredJobs.slice(
    startIndex,
    startIndex + JOBS_PER_PAGE
  );

  const isSaved = (jobId) => savedJobs.some((job) => job.id === jobId);
  const isCompared = (jobId) => compareJobs.some((job) => job.id === jobId);

  const toggleSaveJob = (job) => {
    if (isSaved(job.id)) {
      setSavedJobs((prev) => prev.filter((item) => item.id !== job.id));
    } else {
      setSavedJobs((prev) => [job, ...prev]);
    }
  };

  const removeSavedJob = (jobId) => {
    setSavedJobs((prev) => prev.filter((job) => job.id !== jobId));
  };

  const openJobDetails = (job) => {
    setSelectedJob(job);
    setShowLeaveNotice(false);
    setAnalytics((prev) => ({
      ...prev,
      detailViews: prev.detailViews + 1,
    }));
  };

  const closeJobDetails = () => {
    setSelectedJob(null);
    setShowLeaveNotice(false);
  };

  const handleApplyClick = () => {
    setAnalytics((prev) => ({
      ...prev,
      applyClicks: prev.applyClicks + 1,
    }));
    setShowLeaveNotice(true);
  };

  const handleSearchSubmit = () => {
    const trimmed = search.trim();
    if (!trimmed) return;

    setRecentSearches((prev) => {
      const next = [trimmed, ...prev.filter((item) => item !== trimmed)];
      return next.slice(0, 5);
    });
  };

  const clearAllFilters = () => {
    setSearch("");
    setCategory("All");
    setRegion("All Regions");
    setSource("All Sources");
    setSortBy("Newest");
    setCurrentPage(1);
  };

  const toggleCompareJob = (job) => {
    if (isCompared(job.id)) {
      setCompareJobs((prev) => prev.filter((item) => item.id !== job.id));
      return;
    }

    if (compareJobs.length >= 2) return;
    setCompareJobs((prev) => [...prev, job]);
  };

  const clearComparison = () => {
    setCompareJobs([]);
  };

  const openMap = () => {
    setIsMapOpen(true);
    setSelectedMapGroup(null);
    setSelectedCompany(null);
  };

  const closeMap = () => {
    setIsMapOpen(false);
    setSelectedMapGroup(null);
    setSelectedCompany(null);
  };

  if (loading) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <p className="eyebrow">Global opportunities</p>
          <h1>Job Aggregation Platform</h1>
          <p className="subtext">
            Discover jobs across the world in Gaming and Architecture from one
            place.
          </p>
        </header>

        <div className="panel loading-state">
          <h3>Loading jobs...</h3>
          <p>Please wait while the platform fetches opportunities.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <p className="eyebrow">Global opportunities</p>
        <h1>Job Aggregation Platform</h1>
        <p className="subtext">
          Discover jobs across the world in Gaming and Architecture from one
          place.
        </p>
      </header>

      <section className="hero-grid">
        <div className="panel search-panel">
          <h2>Search jobs globally</h2>

          <div className="search-row">
            <input
              type="text"
              placeholder="Search by role, company, country, or source..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="primary-btn" onClick={handleSearchSubmit}>
              Search
            </button>
          </div>

          {recentSearches.length > 0 && (
            <div className="recent-searches">
              <span className="recent-label">Recent:</span>
              {recentSearches.map((item) => (
                <button
                  key={item}
                  className="recent-chip"
                  onClick={() => setSearch(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          )}

          <div className="controls-grid">
            <div>
              <div className="filter-label">Category</div>
              <div className="button-row">
                {categories.map((item) => (
                  <button
                    key={item}
                    className={category === item ? "active" : ""}
                    onClick={() => setCategory(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="filter-label">Source</div>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                {sources.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="filter-label">Sort By</div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                {sortOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="filters-footer">
            <div className="result-summary">
              Showing <strong>{filteredJobs.length}</strong> matching jobs
            </div>

            <div className="header-actions">
              <button className="secondary-btn" onClick={clearAllFilters}>
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        <div className="panel map-panel">
          <div className="map-header">
            <div>
              <h2>World View</h2>
              <p>
                Open a readable map with visible openings that adapt to zoom.
              </p>
            </div>
            <span className="region-pill">{region}</span>
          </div>

          <div className="region-grid">
            {regions.map((item) => (
              <button
                key={item}
                className={`region-btn ${
                  region === item ? "region-active" : ""
                }`}
                onClick={() => setRegion(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="map-preview-content">
            <div className="map-preview-stat">
              <strong>{mapGroups.length}</strong>
              <span>mapped cities</span>
            </div>
            <div className="map-preview-stat">
              <strong>{remoteOnlyCount}</strong>
              <span>remote only</span>
            </div>
            <button className="open-map-btn" onClick={openMap}>
              Open Detailed Map
            </button>
          </div>

          <div className="map-glow" />
        </div>
      </section>

      <section className="analytics-grid">
        <div className="mini-stat">
          <span>Job detail views</span>
          <strong>{analytics.detailViews}</strong>
        </div>
        <div className="mini-stat">
          <span>Apply clicks</span>
          <strong>{analytics.applyClicks}</strong>
        </div>
        <div className="mini-stat">
          <span>Saved jobs</span>
          <strong>{analytics.savedCount}</strong>
        </div>
      </section>

      {compareJobs.length > 0 && (
        <section className="panel compare-panel">
          <div className="compare-panel-top">
            <div>
              <h2>Compare Jobs</h2>
              <p>Select up to 2 jobs to compare key details.</p>
            </div>
            <button className="secondary-btn" onClick={clearComparison}>
              Clear Comparison
            </button>
          </div>

          <div className={`compare-grid compare-grid-${compareJobs.length}`}>
            {compareJobs.map((job) => (
              <div key={job.id} className="compare-card">
                <h3>{job.title}</h3>
                <p className="company">{job.company}</p>
                <div className="compare-row">
                  <span>Location</span>
                  <strong>{job.location}</strong>
                </div>
                <div className="compare-row">
                  <span>Type</span>
                  <strong>{job.jobType}</strong>
                </div>
                <div className="compare-row">
                  <span>Level</span>
                  <strong>{job.level}</strong>
                </div>
                <div className="compare-row">
                  <span>Mode</span>
                  <strong>{job.workMode}</strong>
                </div>
                <div className="compare-row">
                  <span>Source</span>
                  <strong>{job.source}</strong>
                </div>
                <div className="compare-row">
                  <span>Salary</span>
                  <strong>{job.salary}</strong>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="content-grid">
        <div className="main-column">
          <div className="section-title-row">
            <h2>Available Jobs</h2>
            <span>
              Page {currentPage} of {totalPages}
            </span>
          </div>

          {filteredJobs.length === 0 ? (
            <div className="panel empty-state">
              <h3>No matching jobs found</h3>
              <p>
                Try changing your region, source, category, or search keywords.
              </p>
            </div>
          ) : (
            <>
              <div className="jobs-grid">
                {paginatedJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    isSaved={isSaved(job.id)}
                    isCompared={isCompared(job.id)}
                    canCompareMore={compareJobs.length < 2}
                    onToggleSave={toggleSaveJob}
                    onOpenDetails={openJobDetails}
                    onToggleCompare={toggleCompareJob}
                  />
                ))}
              </div>

              <div className="pagination-bar">
                <button
                  className="secondary-btn"
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1}
                >
                  Previous
                </button>

                <div className="page-numbers">
                  {Array.from(
                    { length: totalPages },
                    (_, index) => index + 1
                  ).map((page) => (
                    <button
                      key={page}
                      className={`page-btn ${
                        currentPage === page ? "page-btn-active" : ""
                      }`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                <button
                  className="secondary-btn"
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            </>
          )}
        </div>

        <aside className="sidebar">
          <div className="panel saved-card">
            <h2>Saved Jobs</h2>
            {savedJobs.length === 0 ? (
              <p className="empty-text">No jobs saved yet.</p>
            ) : (
              <div className="saved-list">
                {savedJobs.map((job) => (
                  <div key={job.id} className="saved-item">
                    <div className="saved-item-top">
                      <div
                        className="saved-item-content"
                        onClick={() => openJobDetails(job)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") openJobDetails(job);
                        }}
                      >
                        <strong>{job.title}</strong>
                        <p>{job.company}</p>
                        <small>
                          {job.posted} • {job.source}
                        </small>
                      </div>

                      <button
                        className="remove-btn"
                        onClick={() => removeSavedJob(job.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </section>

      <MapExplorerModal
        isOpen={isMapOpen}
        onClose={closeMap}
        mapGroups={mapGroups}
        remoteOnlyCount={remoteOnlyCount}
        selectedMapGroup={selectedMapGroup}
        setSelectedMapGroup={setSelectedMapGroup}
        selectedCompany={selectedCompany}
        setSelectedCompany={setSelectedCompany}
        companyJobsInMap={companyJobsInMap}
        isSaved={isSaved}
        toggleSaveJob={toggleSaveJob}
        openJobDetails={openJobDetails}
      />

      <JobModal
        selectedJob={selectedJob}
        isSaved={selectedJob ? isSaved(selectedJob.id) : false}
        onClose={closeJobDetails}
        onToggleSave={toggleSaveJob}
        onApplyClick={handleApplyClick}
        showLeaveNotice={showLeaveNotice}
      />
    </div>
  );
}
