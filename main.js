let PERSONA_1_PROMPT = "";
let PERSONA_1_PROMPT_PREFIX = "";
let PERSONA_2_PROMPT = "";
let PERSONA_2_PROMPT_PREFIX = "";
let currentRole = "";
let currentPromptPrefix = "";
let lastRequestTime = 0;
let delaySeconds = 4;
var prompts = [];

$(document).ready(function() {

    if (!document.cookie.includes("disclaimer_ack=true")) {
        var disclaimerModal = new bootstrap.Modal($("#disclaimer-modal"));
        disclaimerModal.show();
        document.cookie = "disclaimer_ack=true; expires=" + new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
    }

    $.getJSON("prompts.json", function(data) {
        prompts = data.prompts;
        $.each(prompts, function(i, prompt) {
            var $option = $("<option>").val(i).text(prompt.title);
            $("#prompt-select").append($option);
        });
        $("#prompt-select").val("");
    });

    if (!localStorage.getItem('api_key')) {
        $('#message-input, #prompt-select, #message-send').prop('disabled', true);
    }

    $('#API-input-form').submit(function(event) {
        event.preventDefault();
        var form = this;
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
        } else {
            const apiKey = $('#apiKeyInput').val();
            form.classList.remove('was-validated');
            localStorage.setItem('api_key', apiKey);
            $('#message-input, #prompt-select, #message-send').prop('disabled', false);
            $('#apiKeyModal').modal('hide');
        }    
    });

});

$("#prompt-select").change(function() {
    var index = this.value;
    var prompt = prompts[index];

    PERSONA_1_PROMPT = prompt.persona1Prompt.text;
    PERSONA_1_PROMPT_PREFIX = prompt.persona1Prompt.prefix;
    PERSONA_2_PROMPT = prompt.persona2Prompt.text;
    PERSONA_2_PROMPT_PREFIX = prompt.persona2Prompt.prefix;

    currentRole = PERSONA_2_PROMPT;
    currentPromptPrefix = PERSONA_2_PROMPT_PREFIX;
});

$('#chat-form').submit(function(event) {
    event.preventDefault();
    var form = this;
    if (!form.checkValidity()) {
        form.classList.add('was-validated');
    } else {
        const message = $('#message-input').val().trim();
        form.classList.remove('was-validated');
        $(this).find(':input').prop('disabled', true);
        if (message !== '') {
            printMessage('bot1', message, true);

            sendRequest(currentRole, currentPromptPrefix + message).then(response => {
                $('#typing-element').remove();
                if (response.code === 200) {
                    const text = response.data.choices[0].message.content.trim();
                    printMessage('bot2', text, true);
                    sendRecursiveRequest(text, currentRole);
                } else{
                    printMessage('bot2', 'Sorry, something went wrong. Please check the browser console for more information.');
                    console.error(JSON.stringify(response));
                }
            }).catch(error => {
                printMessage('bot2', 'Sorry, something went wrong. Please check the browser console for more information.');
                console.error(error);
            });

            $('#message-input').val('');
        }
    }
});

function printMessage(sender, message, isTyping) {
    const chatContainer = $('#chat-container');
    const messageClass = sender === 'bot1' ? 'bot1' : 'bot2';
    const messageElement = $('<div>').addClass('chat-message').addClass(messageClass).text(message);
    chatContainer.append(messageElement);
    if (isTyping) {
        const messageClass1 = sender === 'bot2' ? 'bot1' : 'bot2';
        const typingElement = $('<div>').addClass('chat-message').addClass(messageClass1).text('typing...');
        typingElement.addClass('typing').attr('id', 'typing-element');
        chatContainer.append(typingElement);
    }
    chatContainer.scrollTop(chatContainer.prop('scrollHeight'));
}

async function sendRecursiveRequest(prompt, currentRole) {
    if (currentRole === PERSONA_2_PROMPT) {
        currentRole = PERSONA_1_PROMPT;
        currentPromptPrefix = PERSONA_1_PROMPT_PREFIX;
        currentReply = 'bot1';
    } else {
        currentRole = PERSONA_2_PROMPT;
        currentPromptPrefix = PERSONA_2_PROMPT_PREFIX;
        currentReply = 'bot2';
    }

    try {
        await waitBeforeRequest();
        const response = await sendRequest(currentRole, currentPromptPrefix + prompt);
        $('#typing-element').remove();
        if (response.code === 200) {
            const text = response.data.choices[0].message.content.trim();
            printMessage(currentReply, text, true);
            sendRecursiveRequest(text, currentRole);
        } else {
            printMessage('bot2', 'Sorry, something went wrong. Please check the browser console for more information.');
            console.error(JSON.stringify(response));
        }
    } catch (error) {
        printMessage('bot2', 'Sorry, something went wrong. Please check the browser console for more information.');
        console.error(error);
    }
}

async function waitBeforeRequest() {
    const currentTime = Date.now();
    const timeSinceLastRequest = currentTime - lastRequestTime;
    if (timeSinceLastRequest < delaySeconds * 1000) {
        const timeToWait = delaySeconds * 1000 - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, timeToWait));
    }
    lastRequestTime = Date.now();
}

async function sendRequest(prompt, msgInput) {
    const API_KEY = localStorage.getItem("api_key") ? localStorage.getItem("api_key").toString() : null;
    const requestOptions = {
        method: 'POST',
        headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
                "model": "gpt-3.5-turbo",
                "messages": [{"role": "system", "content": prompt},{"role": "user", "content": msgInput}],
                "temperature": 0.7,
                "max_tokens": 100
        })
    };
    const response = await fetch('https://api.openai.com/v1/chat/completions', requestOptions);
    const data = await response.json();
    return {
        code: response.status,
        data: data
    };
}