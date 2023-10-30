import {GitHub} from "@actions/github/lib/utils";

import core, {getInput} from '@actions/core';
import {context, getOctokit} from '@actions/github';
import axios from "axios";

enum Status {
    started, success, failed, cancelled, timedout
}

const colors = new Map<Status, number>()
colors[Status.started] = 0xDBAB0A
colors[Status.success] = 0x3FB950
colors[Status.failed] = 0xF85149
colors[Status.cancelled] = 0x7D8590
colors[Status.timedout] = 0xF48381

const userFriendlyName = new Map<Status, string>()
userFriendlyName[Status.started] = "Started"
userFriendlyName[Status.success] = "Successful"
userFriendlyName[Status.failed] = "Failed"
userFriendlyName[Status.timedout] = "Timed Out"
userFriendlyName[Status.cancelled] = "Cancelled"

export async function run(): Promise<any> {
    try {
        const octo: InstanceType<typeof GitHub> = getOctokit(getInput("github_token"));
        const lastCommit = await octo.rest.repos.getCommit({
            ...context.repo,
            ref: context.sha
        })

        const status = getStatus(getInput("status"))

        const fields: any[] = []
        if (getInput("version") && getInput("version") != "?") {
            fields.push({
                "name": "Version",
                "value": getInput("version"),
                "inline": true
            });
        }

        fields.push({
            "name": "Build Branch",
            "value": context.payload.ref!!.toString().replace("refs/heads/", ""),
            "inline": true
        })
        if (getInput('include_commit_message') == '' || getInput('include_commit_message') == 'true') {
            fields.push({
                "name": "Commit message",
                "value": `\`${lastCommit.data.commit.message}\``
            })
        }

        if (getInput('fields')) {
            fields.push(JSON.parse(getInput('fields')))
        }

        const json = {
            username: 'GitHub Actions',
            avatar_url: 'https://avatars.githubusercontent.com/in/15368?v=4',
            "embeds": [
            {
                "title": "Build " + userFriendlyName[status],
                "url": `https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`,
                "color": colors[status],
                "fields": fields,
                "author": {
                    "name": context.repo.repo,
                    "url": `https://github.com/${context.repo.owner}/${context.repo.repo}`,
                    "icon_url": `https://github.com/${context.repo.owner}.png`
                },
                "footer": {
                    "text": lastCommit.data.author!!.login,
                    "icon_url": lastCommit.data.author!!.avatar_url
                }
            }
        ]}

        await axios.post(getInput("webhook_url"), json, {
            headers: {
                'Content-Type': 'application/json'
            }
        })

        console.log(lastCommit!!.data!!.author!!.login)
    } catch (error) {
        // @ts-ignore
        core.setFailed(error.message);
    }
}

function getStatus(status: string): Status {
    switch (status.toLowerCase()) {
        case "success": return Status.success
        case "failure": return Status.failed
        case "failed": return Status.failed

        case "cancelled": return Status.cancelled
        case "skipped": return Status.cancelled

        case "timed_out": return Status.timedout
        default: return Status.started
    }
}

run()