body: JSON.stringify({
  model: 'llama-3.1-8b-instant',
  messages: [
    { 
      role: 'system', 
      content: 'Tu es un expert économiste de la construction en France. Tu donnes TOUJOURS une estimation de prix même approximative. Ne dis jamais que tu ne sais pas. Réponds uniquement avec le prix et l\'unité.' 
    },
    { 
      role: 'user', 
      content: `Prix moyen HT constaté en France pour: ${designation}. Exemples de format: 450€/m², 1800€/U, 120€/ml. Donne juste le prix.` 
    }
  ],
  temperature: 0.1,
  max_tokens: 20
})
