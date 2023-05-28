
const SERVER_BASE_URL= "http://localhost:3000";

function downloadArrayAsTxtFile(array, fileName) {
    const content = array.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();

    // Cleanup
    URL.revokeObjectURL(url);
}

const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
        reader.readAsText(file);
    });
};

const chunkArray = (array, size) => {
    const chunkedArray = [];
    let index = 0;

    while (index < array.length) {
        chunkedArray.push(array.slice(index, index + size));
        index += size;
    }

    return chunkedArray;
};

class Tab1 {
    constructor() {
        this.form = document.getElementById("pane1_form")
        this.submitButton = document.getElementById("pane1_submit");
        this.fileInput = document.getElementById('pane1_file_input');
        this.table = document.getElementById("pane1_table");
        this.tbody = document.getElementById("pane1_tbody");
        this.loader = document.getElementById("pane1_loader");
        this.taskSubmitButton = document.getElementById("pane1_task_submit");
        console.log(this.form);
        this.form.addEventListener('submit', (e) => {
            e.preventDefault()
            this.submitButton.disabled = true;
            const file = this.fileInput.files[0];
            this.loader.classList.remove("d-none");
            this.generateTable(file);
        });
    }

     generateTableRows = (data) => {
        const tbody = this.tbody;

        // Clear existing rows
        tbody.innerHTML = '';

        // Loop through the data array and create a row for each object
         data.forEach((item, index) => {
            const row = document.createElement('tr');

            // Create cells for each property
            const tagNameCell = document.createElement('td');
            tagNameCell.textContent = item.tagName;

            const gifIdCell = document.createElement('td');
            gifIdCell.textContent = item.gifId;

            const titleCell = document.createElement('td');
            titleCell.textContent = item.title;

            const urlCell = document.createElement('td');
            urlCell.innerHTML = `<a href="${item.url}" target="_blank">${item.url}</a>`;

            const targetCountCell = document.createElement('td');
            const targetCountInput = document.createElement('input');
            targetCountInput.type = 'number';
            targetCountInput.value = item.targetCount;
            targetCountInput.classList.add('form-control');
            targetCountInput.addEventListener('change', () => {
                data[index].targetCount = parseInt(targetCountInput.value);
            });
            targetCountCell.appendChild(targetCountInput);

            const actionCell = document.createElement('td');
            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Delete';
            deleteButton.classList.add('btn', 'btn-danger', 'btn-sm');
            deleteButton.addEventListener('click', () => {
                row.remove()
            });
            actionCell.appendChild(deleteButton);

            // Append cells to the row
            row.appendChild(tagNameCell);
            row.appendChild(gifIdCell);
            row.appendChild(titleCell);
            row.appendChild(urlCell);
            row.appendChild(targetCountCell);
            row.appendChild(actionCell);

            // Append the row to the table body
            tbody.appendChild(row);
        });
         this.loader.classList.add("d-none");
         this.taskSubmitButton.classList.remove("d-none");
         this.taskSubmitButton.addEventListener('click',this.submitTasks)
    };

    submitTasks = (e) => {
        e.preventDefault();
        const payload = {};
        this.taskSubmitButton.disabled = true;

        for(let i = 0; i<this.tbody.children.length; i++){
            const row = this.tbody.children[i].children;
            const tagName = row[0].innerText;
            const gifId = row[1].innerText;
            const targetCount = row[4].children[0].value;
            if(payload[tagName] === undefined){
                payload[tagName] = {}
            }
            payload[tagName][gifId] = targetCount;
        }

        this.table.remove();

        fetch(`${SERVER_BASE_URL}/bulk-tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
            .then(response => {
                if (response.ok) {
                    // Request successful
                    alert('Task created successfully. Click on ok reload.');
                } else {
                    // Request failed
                    alert('Failed to create task. Click on ok reload.');
                }
            })
            .catch(error => {
                // Network or server error
                console.error('Error:', error);
                alert('An error occurred. Click on ok reload.');
            });

        console.log(payload);
    }

    generateTable = async (file) => {
        const gifURLs = (await readFileContent(file)).split('\n');
        const gifIds = gifURLs.map(url => {
            const lastIndex = url.lastIndexOf('-');
            return url.substring(lastIndex + 1);
        });
        const rows = [];
        if (gifIds.length > 0) {
            const chunkedIds = chunkArray(gifIds, 50);
            const apiKey = 'L8eXbxrbPETZxlvgXN9kIEzQ55Df04v0';

            for (const chunk of chunkedIds) {
                const idsParam = chunk.join(',');
                const apiUrl = `https://api.giphy.com/v1/gifs?api_key=${apiKey}&ids=${idsParam}`;

                // Make API request using the apiUrl
                // Process the response as needed
                await fetch(apiUrl)
                    .then(response => response.json())
                    .then(data => {
                        data.data.forEach(entity => {
                            if(entity.type === "gif"){
                               entity.tags.forEach(tag => {
                                  rows.push({
                                      tagName: tag,
                                      gifId: entity.id,
                                      title: entity.title,
                                      url: entity.url,
                                      targetCount: 1000
                                  })

                               })
                            }
                        })
                    })
                    .catch(error => {
                        console.error('Error fetching data from API:', error);
                    });
            }
        } else {
            console.log('No GIF IDs found in the text file.');
        }
        this.form.classList.add("d-none");
        this.table.classList.remove("d-none");
        this.generateTableRows(rows);
    }
}

class Tab2 {
    constructor() {
        this.form = document.getElementById("pane2_form");
        this.input = document.getElementById("pane2_channel_url");
        this.submitButton = document.getElementById("pane2_submit");
        this.loader = document.getElementById("pane2_loader");
        this.result = document.getElementById("pane2_result");
        this.channelName = document.getElementById("pane2_channel_name");
        this.totalGifs = document.getElementById("pane2_total_gifs");

        this.form.addEventListener('submit', this.handleFormSubmit);
    }

    handleFormSubmit = (event) => {
        event.preventDefault();
        console.log(this.submitButton)
        this.submitButton.disabled = true;
        this.fetchChannelData(this.input.value.substring(this.input.value.lastIndexOf('/') + 1))
    }

    fetchGifs = async (id) => {
        const total = this.uploadCount;
        const gifs = [];
        let offset = 0;
        let nextUrl = `${SERVER_BASE_URL}/feed?channelId=${id}&offset=${offset}`;
        do {
            const page =  (await (await fetch(nextUrl)).json());

            if(page.next === null){
                nextUrl = null;
            } else {
                offset = (new URL(page.next)).searchParams.get("offset");
                nextUrl = `${SERVER_BASE_URL}/feed?channelId=${id}&offset=${offset}`;

                this.loader.children[0].children[0].style.width = Math.round(100 * (Number(offset) + 25)/total) + '%';
            }

            page.results.forEach(result => {
                gifs.push(result.url);
            })

        } while(nextUrl);
        this.loader.children[0].children[0].style.width = '100%';
        return gifs
    }

    fetchChannelData = (channelName) => {
        fetch(`https://api.giphy.com/v1/channels/search?api_key=Gc7131jiJuvI7IdN0HZ1D7nh0ow5BU6g&q=${channelName}&limit=1`)
            .then(response => response.json())
            .then(data => {
                const {id, display_name} = data.data[0];
                this.channelName.innerText = display_name;
                this.channelId = id;
                this.userId = data.data[0].user.id;
                return id;
            }).then((id) => {
                fetch(`https://giphy.com/api/v1/users/${this.userId}/view-count/`)
                    .then(response => response.json())
                    .then((response) => {
                        const {uploadCount} = response;
                        this.totalGifs.innerText = uploadCount;
                        this.uploadCount = uploadCount;
                        return id;
                    })
            }).then(() => {
            this.result.classList.remove("d-none");
            this.loader.classList.remove("d-none");
        }).then(() => {
            setTimeout(() => {
                this.fetchGifs(this.channelId).then(gifs => {
                    downloadArrayAsTxtFile(gifs, "gifs.txt");
                    console.log("Done");
                })
            }, 3000)
        })
    }

}


class Tab3 {
    constructor() {
        this.tbody = document.getElementById("pane3_tbody");
        this.countdownElement = document.getElementById('pane3_countdown');
        this.fetchProgressData();
        setInterval(this.fetchProgressData, 30000);
        setInterval(() => {
            this.countdownElement.innerText = `${(Number(this.countdownElement.innerText) - 1)}`;
        }, 1000);
    }

    fetchProgressData = () => {
        fetch(`${SERVER_BASE_URL}/progress`)
            .then(response => response.json())
            .then(data => {
                this.populateTable(data);
                this.countdownElement.innerText = "30";
            })
            .catch(error => {
                console.error('Error fetching progress data:', error);
            });
    }

    populateTable = (data) => {
        this.tbody.innerHTML = "";
        data.forEach(item => {
            const { tagName, batchId, currentCount, possibleTargetCount, impossibleTargetCount, createdAt } = item;
            const row = this.createTableRow(tagName, batchId, currentCount, possibleTargetCount, impossibleTargetCount, createdAt);
            this.tbody.appendChild(row);
        });
    }

    createTableRow = (tagName, batchId, currentCount, possibleTargetCount, skipped, createdAt) => {
        const progress = possibleTargetCount ? Math.round((currentCount / possibleTargetCount) * 100) : 0;
        const row = document.createElement('tr');

        const tagNameCell = document.createElement('td');
        tagNameCell.textContent = tagName;
        row.appendChild(tagNameCell);

        const batchIdCell = document.createElement('td');
        batchIdCell.textContent = batchId;
        row.appendChild(batchIdCell);

        const progressCell = document.createElement('td');
        const progressBar = document.createElement('div');
        progressBar.classList.add('progress', 'mb-1');

        const progressValue = document.createElement('div');
        progressValue.classList.add('progress-bar');
        progressValue.setAttribute('role', 'progressbar');
        progressValue.setAttribute('style', `width: ${progress}%`);
        progressValue.setAttribute('aria-valuenow', progress.toString());
        progressValue.setAttribute('aria-valuemin', '0');
        progressValue.setAttribute('aria-valuemax', '100');

        // Color coding based on progress percentage
        if (progress >= 75) {
            progressValue.classList.add('bg-success');
        } else if (progress >= 50) {
            progressValue.classList.add('bg-warning');
        } else {
            progressValue.classList.add('bg-danger');
        }

        if(Number(possibleTargetCount) === 0){
            progressValue.setAttribute('style', `width: 100%`);
            progressValue.setAttribute('aria-valuenow', "100");
            progressValue.classList.add('bg-danger');
        }

        progressBar.appendChild(progressValue);
        progressCell.appendChild(progressBar);
        progressCell.appendChild(document.createTextNode(`${currentCount}/${possibleTargetCount}`));
        row.appendChild(progressCell);

        const skippedCell = document.createElement('td');
        skippedCell.textContent = `${skipped}`;
        row.appendChild(skippedCell);

        const createdAtCell = document.createElement('td');
        createdAtCell.textContent = new Date(createdAt).toLocaleString();
        row.appendChild(createdAtCell);

        return row;
    }

}

const tab1 = new Tab1();
const tab2 = new Tab2();
const tab3 = new Tab3();

console.log("Loaded");