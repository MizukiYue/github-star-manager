use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, AUTHORIZATION, USER_AGENT};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct GitHubRepo {
    pub id: i64,
    pub name: String,
    pub full_name: String,
    pub description: Option<String>,
    pub html_url: String,
    pub language: Option<String>,
    pub stargazers_count: i64,
    pub topics: Option<Vec<String>>,
    pub owner: GitHubOwner,
}

#[derive(Debug, Deserialize)]
pub struct GitHubOwner {
    pub login: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct StarredRepo {
    pub starred_at: String,
    pub repo: GitHubRepo,
}

pub struct GitHubClient {
    client: reqwest::Client,
    token: String,
}

impl GitHubClient {
    pub fn new(token: &str) -> Self {
        Self {
            client: reqwest::Client::new(),
            token: token.to_string(),
        }
    }

    fn headers(&self) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {}", self.token)).unwrap(),
        );
        headers.insert(
            ACCEPT,
            HeaderValue::from_static("application/vnd.github.star+json"),
        );
        headers.insert(USER_AGENT, HeaderValue::from_static("github-star-manager"));
        headers
    }

    /// 获取用户 starred repos（分页）
    /// 返回 (repos, has_next_page)
    pub async fn get_starred_repos(
        &self,
        page: u32,
        per_page: u32,
    ) -> Result<(Vec<StarredRepo>, bool), String> {
        let url = format!(
            "https://api.github.com/user/starred?page={}&per_page={}&sort=created&direction=desc",
            page, per_page
        );

        let response = self
            .client
            .get(&url)
            .headers(self.headers())
            .send()
            .await
            .map_err(|e| format!("请求失败: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("GitHub API 错误 ({}): {}", status, body));
        }

        // 检查是否有下一页
        let has_next = response
            .headers()
            .get("link")
            .and_then(|v| v.to_str().ok())
            .map(|link| link.contains("rel=\"next\""))
            .unwrap_or(false);

        let repos: Vec<StarredRepo> = response
            .json()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))?;

        Ok((repos, has_next))
    }

    /// 获取所有 starred repos（自动分页）
    pub async fn get_all_starred_repos(&self) -> Result<Vec<StarredRepo>, String> {
        let mut all_repos = Vec::new();
        let mut page = 1;
        let per_page = 100;

        loop {
            let (repos, has_next) = self.get_starred_repos(page, per_page).await?;

            if repos.is_empty() {
                break;
            }

            all_repos.extend(repos);

            if !has_next {
                break;
            }

            page += 1;
        }

        Ok(all_repos)
    }
}
