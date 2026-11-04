
/* =========================================
   CINESCOPE - MOVIE DISCOVERY APPLICATION
   TMDB API + CLOUDFLARE WORKER
========================================= */

// =========================================
// 1. GET HTML ELEMENTS
// =========================================

const movieGrid = document.getElementById("movieGrid");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const statusMessage = document.getElementById("statusMessage");
const sectionTitle = document.getElementById("sectionTitle");
const sectionDescription = document.getElementById("sectionDescription");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const exploreBtn = document.getElementById("exploreBtn");

const genreList = document.getElementById("genreList");

const favoritesGrid = document.getElementById("favoritesGrid");
const favoritesEmpty = document.getElementById("favoritesEmpty");
const favoritesSection = document.getElementById("favorites");

const favoritesLink = document.getElementById("favoritesLink");
const homeLink = document.getElementById("homeLink");
const popularLink = document.getElementById("popularLink");

const movieModal = document.getElementById("movieModal");
const modalContent = document.getElementById("modalContent");
const closeModal = document.getElementById("closeModal");

// =========================================
// 2. APP STATE
// =========================================

let currentPage = 1;
let currentSearch = "";
let currentGenre = "";
let isLoading = false;

let favoriteMovies = [];

try {
    favoriteMovies = JSON.parse(
        localStorage.getItem("cinescopeFavorites") || "[]"
    );

    if (!Array.isArray(favoriteMovies)) {
        favoriteMovies = [];
    }
} catch (error) {
    favoriteMovies = [];
}

// =========================================
// 3. FAVORITES FUNCTIONALITY
// =========================================

function saveFavorites() {
    localStorage.setItem(
        "cinescopeFavorites",
        JSON.stringify(favoriteMovies)
    );
}

function isFavorite(movieId) {
    return favoriteMovies.some(
        movie => movie.id === movieId
    );
}

function toggleFavorite(movie) {

    if (isFavorite(movie.id)) {

        favoriteMovies = favoriteMovies.filter(
            item => item.id !== movie.id
        );

    } else {

        favoriteMovies.push(movie);

    }

    saveFavorites();

    displayFavorites();
    updateFavoriteButtons(movie.id);
}

function updateFavoriteButtons(movieId) {

    document.querySelectorAll(".movie-card").forEach(card => {

        if (Number(card.dataset.movieId) !== movieId) {
            return;
        }

        const button = card.querySelector(".favorite-btn");

        if (!button) return;

        const saved = isFavorite(movieId);

        button.textContent = saved ? "♥" : "♡";

        button.classList.toggle("active", saved);

        button.setAttribute(
            "aria-label",
            saved ? "Remove from favorites" : "Add to favorites"
        );

    });
}

function displayFavorites() {

    if (!favoritesGrid || !favoritesEmpty) return;

    favoritesGrid.innerHTML = "";

    favoritesEmpty.hidden = favoriteMovies.length > 0;

    favoriteMovies.forEach(movie => {

        const card = createMovieCard(movie);

        favoritesGrid.appendChild(card);

    });
}

function showFavorites() {

    if (!favoritesSection) return;

    favoritesSection.hidden = false;

    movieGrid.hidden = true;
    statusMessage.hidden = true;
    loadMoreBtn.hidden = true;

    displayFavorites();

    favoritesSection.scrollIntoView({
        behavior: "smooth"
    });
}

// =========================================
// 4. CREATE MOVIE CARD
// =========================================

function createMovieCard(movie) {

    const card = document.createElement("article");

    card.className = "movie-card";
    card.dataset.movieId = movie.id;

    // MOVIE POSTER

    const poster = document.createElement("img");

    poster.src = movie.poster_path
        ? `${IMAGE_URL}${movie.poster_path}`
        : "https://placehold.co/300x450/101a2b/ffffff?text=No+Poster";

    poster.alt = `${movie.title} poster`;
    poster.loading = "lazy";

    // FAVORITE BUTTON

    const favoriteBtn = document.createElement("button");

    favoriteBtn.className = "favorite-btn";

    favoriteBtn.textContent = isFavorite(movie.id) ? "♥" : "♡";

    favoriteBtn.classList.toggle(
        "active",
        isFavorite(movie.id)
    );

    favoriteBtn.setAttribute(
        "aria-label",
        isFavorite(movie.id)
            ? "Remove from favorites"
            : "Add to favorites"
    );

    favoriteBtn.addEventListener("click", event => {

        event.stopPropagation();

        toggleFavorite(movie);

    });

    // MOVIE INFORMATION

    const info = document.createElement("div");
    info.className = "movie-info";

    const title = document.createElement("h3");
    title.textContent = movie.title || "Untitled Movie";

    const rating = document.createElement("p");
    rating.className = "movie-rating";

    rating.textContent =
        `⭐ ${Number(movie.vote_average || 0).toFixed(1)} / 10`;

    const releaseDate = document.createElement("p");
    releaseDate.className = "movie-date";

    releaseDate.textContent =
        `Release: ${movie.release_date || "Unknown"}`;

    const overview = document.createElement("p");
    overview.className = "movie-overview";

    overview.textContent =
        movie.overview || "No description available.";

    info.appendChild(title);
    info.appendChild(rating);
    info.appendChild(releaseDate);
    info.appendChild(overview);

    card.appendChild(poster);
    card.appendChild(favoriteBtn);
    card.appendChild(info);

    return card;
}

// =========================================
// 5. DISPLAY MOVIES
// =========================================

function displayMovies(movies, page) {

    if (page === 1) {
        movieGrid.innerHTML = "";
    }

    movies.forEach(movie => {

        const card = createMovieCard(movie);

        movieGrid.appendChild(card);

    });
}

// =========================================
// 6. FETCH MOVIES THROUGH CLOUDFLARE
// =========================================

async function fetchMovies(page = 1, searchTerm = "") {

    if (isLoading) return;

    isLoading = true;

    loadMoreBtn.disabled = true;

    if (page === 1) {

        movieGrid.innerHTML = "";

        statusMessage.hidden = false;

        statusMessage.textContent = searchTerm
            ? "Searching for movies..."
            : "Loading movies...";

        statusMessage.className = "status-message";

    }

    try {

        let endpoint;

        if (searchTerm) {

            endpoint = `${API_URL}/search/movie`;

        } else if (currentGenre) {

            endpoint = `${API_URL}/discover/movie`;

        } else {

            endpoint = `${API_URL}/movie/popular`;

        }

        const url = new URL(endpoint);

        url.searchParams.set("language", "en-US");
        url.searchParams.set("page", page);

        if (searchTerm) {
            url.searchParams.set("query", searchTerm);
        }

        if (currentGenre && !searchTerm) {

            url.searchParams.set("with_genres", currentGenre);

            url.searchParams.set("sort_by", "popularity.desc");

        }

        const response = await fetch(url);

        if (!response.ok) {

            const errorData = await response.json();

            throw new Error(
                errorData.status_message ||
                errorData.error ||
                "Unable to load movies."
            );

        }

        const data = await response.json();

        displayMovies(data.results || [], page);

        currentPage = page;

        statusMessage.textContent =
            data.results.length === 0 && page === 1
                ? "No movies found."
                : "";

        loadMoreBtn.hidden = page >= data.total_pages;

    } catch (error) {

        console.error("CineScope Error:", error);

        statusMessage.hidden = false;

        statusMessage.textContent =
            error.message || "Something went wrong.";

        statusMessage.className = "status-message error";

        loadMoreBtn.hidden = true;

    } finally {

        isLoading = false;

        loadMoreBtn.disabled = false;

    }
}

// =========================================
// 7. SEARCH MOVIES
// =========================================

function searchMovies() {

    const searchTerm = searchInput.value.trim();

    currentGenre = "";

    document.querySelectorAll(".genre-btn").forEach(button => {
        button.classList.remove("active");
    });

    const allButton = document.querySelector(
        '.genre-btn[data-genre="all"]'
    );

    if (allButton) {
        allButton.classList.add("active");
    }

    if (!searchTerm) {

        currentSearch = "";

        sectionTitle.textContent = "Popular Movies";

        sectionDescription.textContent =
            "Discover movies people are watching.";

        fetchMovies(1);

        return;
    }

    currentSearch = searchTerm;

    sectionTitle.textContent = `Results for "${searchTerm}"`;

    sectionDescription.textContent =
        "Movies matching your search.";

    fetchMovies(1, currentSearch);

}

searchBtn.addEventListener("click", searchMovies);

searchInput.addEventListener("keydown", event => {

    if (event.key === "Enter") {
        searchMovies();
    }

});

// =========================================
// 8. MOVIE DETAILS
// =========================================

async function openMovieDetails(movieId) {

    movieModal.classList.add("show");

    modalContent.innerHTML = "<p>Loading movie details...</p>";

    try {

        const response = await fetch(
            `${API_URL}/movie/${movieId}?language=en-US`
        );

        if (!response.ok) {
            throw new Error("Could not load movie details.");
        }

        const movie = await response.json();

        const backdrop = movie.backdrop_path
            ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`
            : "https://placehold.co/1280x500/101a2b/ffffff?text=CineScope";

        const genres = (movie.genres || [])
            .map(genre => `<span class="genre-tag">${genre.name}</span>`)
            .join("");

        modalContent.innerHTML = `

            <img
                src="${backdrop}"
                class="modal-backdrop"
                alt="${movie.title} backdrop"
            >

            <div class="modal-details">

                <h2>${movie.title}</h2>

                <p class="modal-rating">
                    ⭐ ${Number(movie.vote_average || 0).toFixed(1)} / 10
                </p>

                <p>
                    Release Date:
                    ${movie.release_date || "Unknown"}
                </p>

                <p>
                    Runtime:
                    ${movie.runtime ? movie.runtime + " minutes" : "Unknown"}
                </p>

                <div class="modal-genres">
                    ${genres}
                </div>

                <h3>Movie Overview</h3>

                <p>
                    ${movie.overview || "No description available."}
                </p>

            </div>

        `;

    } catch (error) {

        console.error("Movie Details Error:", error);

        modalContent.textContent =
            "Unable to load movie details. Please try again.";

    }
}

// =========================================
// 9. CLICKABLE MOVIE CARDS
// =========================================

function handleMovieCardClick(event) {

    const card = event.target.closest(".movie-card");

    if (!card) return;

    if (event.target.closest(".favorite-btn")) return;

    const movieId = card.dataset.movieId;

    if (movieId) {
        openMovieDetails(movieId);
    }

}

movieGrid.addEventListener("click", handleMovieCardClick);

if (favoritesGrid) {
    favoritesGrid.addEventListener("click", handleMovieCardClick);
}

// =========================================
// 10. CLOSE MOVIE DETAILS
// =========================================

closeModal.addEventListener("click", () => {

    movieModal.classList.remove("show");

});

movieModal.addEventListener("click", event => {

    if (event.target === movieModal) {
        movieModal.classList.remove("show");
    }

});

document.addEventListener("keydown", event => {

    if (event.key === "Escape") {
        movieModal.classList.remove("show");
    }

});

// =========================================
// 11. LOAD MORE MOVIES
// =========================================

loadMoreBtn.addEventListener("click", () => {

    fetchMovies(currentPage + 1, currentSearch);

});

// =========================================
// 12. EXPLORE BUTTON
// =========================================

exploreBtn.addEventListener("click", () => {

    document.getElementById("popular").scrollIntoView({
        behavior: "smooth"
    });

});

// =========================================
// 13. GENRE FILTERING
// =========================================

async function loadGenres() {

    try {

        const response = await fetch(
            `${API_URL}/genre/movie/list?language=en`
        );

        if (!response.ok) {
            throw new Error("Unable to load genres.");
        }

        const data = await response.json();

        data.genres.forEach(genre => {

            const button = document.createElement("button");

            button.className = "genre-btn";

            button.textContent = genre.name;

            button.dataset.genre = genre.id;

            button.addEventListener("click", () => {

                currentGenre = String(genre.id);

                currentSearch = "";

                searchInput.value = "";

                document.querySelectorAll(".genre-btn")
                    .forEach(btn => btn.classList.remove("active"));

                button.classList.add("active");

                sectionTitle.textContent = `${genre.name} Movies`;

                sectionDescription.textContent =
                    `Explore popular ${genre.name.toLowerCase()} movies.`;

                fetchMovies(1);

            });

            genreList.appendChild(button);

        });

    } catch (error) {

        console.error("Genre Error:", error);

    }

}

// =========================================
// 14. ALL MOVIES BUTTON
// =========================================

const allMoviesButton = genreList.querySelector(
    '[data-genre="all"]'
);

allMoviesButton.addEventListener("click", () => {

    currentGenre = "";

    currentSearch = "";

    searchInput.value = "";

    document.querySelectorAll(".genre-btn")
        .forEach(btn => btn.classList.remove("active"));

    allMoviesButton.classList.add("active");

    sectionTitle.textContent = "Popular Movies";

    sectionDescription.textContent =
        "Discover movies people are watching.";

    fetchMovies(1);

});

// =========================================
// 15. FAVORITES NAVIGATION
// =========================================

favoritesLink.addEventListener("click", event => {

    event.preventDefault();

    document.querySelectorAll(".sidebar nav a")
        .forEach(link => link.classList.remove("active"));

    favoritesLink.classList.add("active");

    showFavorites();

});

function returnToMovies() {

    favoritesSection.hidden = true;

    movieGrid.hidden = false;

    statusMessage.hidden = false;

    document.querySelectorAll(".sidebar nav a")
        .forEach(link => link.classList.remove("active"));

    if (currentSearch || currentGenre) {

        // Keep the existing search or genre results.

    } else {

        fetchMovies(1);

    }

}

homeLink.addEventListener("click", event => {

    event.preventDefault();

    returnToMovies();

});

popularLink.addEventListener("click", event => {

    event.preventDefault();

    returnToMovies();

});

// =========================================
// 16. START CINESCOPE
// =========================================

fetchMovies(1);

loadGenres();
