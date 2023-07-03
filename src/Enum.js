module.exports = {
	moduleTypes: [
		{
			"label": "Action",
			"description": "4"
		},
		{
			"label": "Search",
			"description": "9"
		},
		{
			"label": "Trigger (polling)",
			"description": "1"
		},
		{
			"label": "Instant trigger",
			"description": "10"
		},
		{
			"label": "Responder",
			"description": "11"
		},
		{
			"label": "Universal",
			"description": "12"
		}
	],
	universalModuleSubtypes: [
		{
			"label": "REST",
			"description": "Universal"
		},
		{
			"label": "GraphQL",
			"description": "UniversalGraphQL"
		}
	],
	webhookTypes: [
		{
			"label": "Dedicated",
			"description": "web"
		},
		{
			"label": "Shared",
			"description": "web-shared"
		}
	],
	connectionTypes: [
		{
			"label": "OAuth 2 (authorization code)",
			"description": "oauth"
		},
		{
			"label": "OAuth 2 (authorization code + refresh token)",
			"description": "oauth-refresh"
		},
		{
			"label": "OAuth 2 (resource owner credentials)",
			"description": "oauth-resowncre"
		},
		{
			"label": "OAuth 2 (client credentials)",
			"description": "oauth-clicre"
		},
		{
			"label": "OAuth 1",
			"description": "oauth-1"
		},
		{
			"label": "API key",
			"description": "apikey"
		},
		{
			"label": "Basic auth",
			"description": "basic"
		},
		{
			"label": "Other",
			"description": "other"
		}
	],
	logout: [
		{
			"label": "No",
			"description": "Keep me logged in."
		},
		{
			"label": "Yes",
			"description": "Log me out, please."
		}
	],
	delete: [
		{
			"label": "No",
			"description": "Don't do that."
		},
		{
			"label": "Yes",
			"description": "Continue and delete."
		}
	],
	commit: [
		{
			"label": "No",
			"description": "No changes will be commited."
		},
		{
			"label": "Yes",
			"description": "All changes in the app will be commited and available for public users."
		}
	],
	notify: [
		{
			"label": "No",
			"description": "Don't notify."
		},
		{
			"label": "Yes",
			"description": "Generate the notification."
		}
	],
	rollback: [
		{
			"label": "No",
			"description": "All changes will be kept."
		},
		{
			"label": "Yes",
			"description": "All changes will be rolled back."
		}
	],
	hide: [
		{
			"label": "No",
			"description": "Keep public."
		},
		{
			"label": "Yes",
			"description": "Mark as private."
		}
	],
	publish: [
		{
			"label": "No",
			"description": "Keep private."
		},
		{
			"label": "Yes",
			"description": "Mark as public."
		}
	],
	crud: [
		{
			"label": "Multipurpose",
			"description": "Select this if the action is multipurpose. Default option."
		},
		{
			"label": "Create",
			"description": "The action creates a new entity."
		},
		{
			"label": "Read",
			"description": "The action retrieves a specific entity."
		},
		{
			"label": "Update",
			"description": "The action updates an existing entity."
		},
		{
			"label": "Delete",
			"description": "The action deletes an existing entity."
		}
	],
	moduleTypeActionSearch: [
		{
			"label": "Don't change",
			"description": "keep"
		},
		{
			"label": "Action",
			"description": "4"
		},
		{
			"label": "Search",
			"description": "9"
		}
	]
}
