import axios from 'axios'

const client = axios.create({
  baseURL: '/api',
  timeout: 60000,
})

export const api = {
  upload: async (file) => {
    const form = new FormData()
    form.append('file', file)
    const { data } = await client.post('/datasets/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },
  getProfile: async (id) => (await client.get(`/datasets/${id}/profile`)).data,
  getPreview: async (id, rows = 25) => (await client.get(`/datasets/${id}/preview`, { params: { rows } })).data,
  applyCleaning: async (id, actions) => (await client.post(`/datasets/${id}/clean`, { actions })).data,
  resetCleaning: async (id) => (await client.post(`/datasets/${id}/reset`)).data,
  getStats: async (id) => (await client.get(`/datasets/${id}/stats`)).data,
  getCorrelation: async (id) => (await client.get(`/datasets/${id}/correlation`)).data,
  getChartSuggestions: async (id) => (await client.get(`/datasets/${id}/chart-suggestions`)).data,
  chartHistogram: async (id, column) => (await client.post(`/datasets/${id}/charts/histogram`, { column })).data,
  chartBoxplot: async (id, column) => (await client.post(`/datasets/${id}/charts/boxplot`, { column })).data,
  chartBar: async (id, column) => (await client.post(`/datasets/${id}/charts/bar`, { column })).data,
  chartPie: async (id, column) => (await client.post(`/datasets/${id}/charts/pie`, { column })).data,
  chartScatter: async (id, x, y) => (await client.post(`/datasets/${id}/charts/scatter`, { x, y })).data,
  chartTimeseries: async (id, date_column, value_column) =>
    (await client.post(`/datasets/${id}/charts/timeseries`, { date_column, value_column })).data,
  runML: async (id, target, n_clusters) => (await client.post(`/datasets/${id}/ml/run`, { target, n_clusters })).data,
  getRecommendations: async (id, target) =>
    (await client.get(`/datasets/${id}/recommendations`, { params: { target } })).data,
  createReport: async (id, target, include_ml = true) =>
    (await client.post(`/datasets/${id}/report`, { target, include_ml })).data,
  reportDownloadUrl: (id) => `/api/datasets/${id}/report/download`,
  deleteDataset: async (id) => (await client.delete(`/datasets/${id}`)).data,
}

export default api
