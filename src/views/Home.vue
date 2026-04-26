<template lang="pug">
div
  b-alert(v-if="$isAndroid" show)
    | #[b {{ $tr('Note:') }}] {{ $tr('ActivityWatch on Android is in a very early stage of development. There will be bugs, but we hope you bear with us as we refine things and get it on par with the desktop version of ActivityWatch (which you should try!).') }}

  h3 {{ $tr('Hello early user,') }}
  p
    | {{ $tr("It's still early days for ActivityWatch") }}#[span(v-if="$isAndroid") {{ $tr('(especially on Android!)') }}]{{ $tr(". We've come a long way but we need users (like you!) to provide feedback and help us turn ActivityWatch into a successful project. Early users like you mean a lot to us, and we hope you'll reach out to us with any ideas you have for improvements!") }}
  p
    | {{ $tr('If you are a developer, we hope you can contribute by writing a watcher, visualization, or something else, and share it with us on the forum!') }}
  p
    div {{ $tr('Thank you for using ActivityWatch!') }}
    small
      span {{ $tr('If you have a minute to spare, please take the time to fill out our ') }}
      a(href="https://forms.gle/q2N9K5RoERBV8kqPA") {{ $tr('user survey') }}
      span {{ $tr(' or ') }}
      a(href="https://forum.activitywatch.net/c/features") {{ $tr('vote on features on the forum') }}
      span .

  hr

  div.row
    div.col-md-6
      h4 {{ $tr('Spread the word') }}
      p
        | {{ $tr('Nothing is as motivating as getting ActivityWatch into the hands of users.') }}
        | {{ $tr('By sharing it you get us to make ActivityWatch even better!') }}
      ul
        li
          span {{ $tr('Give us a like and a review on ') }}
          a(href="https://alternativeto.net/software/activitywatch/") AlternativeTo
        li
          span {{ $tr('Vote on us at ') }}
          a(href="https://www.producthunt.com/posts/activitywatch") ProductHunt
        li
          span {{ $tr('Follow us and spread the word on ') }}
          a(href="https://twitter.com/ActivityWatchIt") Twitter
          span {{ $tr(' and ') }}
          a(href="https://www.facebook.com/ActivityWatch") Facebook
        li
          span {{ $tr('Star us on ') }}
          a(href="https://github.com/ActivityWatch/activitywatch") GitHub

    div.col-md-6
      h4 {{ $tr('Support us!') }}
      p
        | {{ $tr('Do you like ActivityWatch? Has it helped you? Help us help you by donating!') }}
        | {{ $tr('You can donate to us via:') }}
      ul
        li #[a(href="https://www.patreon.com/erikbjare") Patreon]
        li #[a(href="https://opencollective.com/activitywatch") Open Collective]
        li #[a(href="https://liberapay.com/ActivityWatch/") Liberapay]
        li #[a(href="https://activitywatch.net/donate/") Other methods] (incl. cryptocurrency)
      p
        | {{ $tr('For more info, please visit the ') }}
        a(href="https://activitywatch.net/donate/") {{ $tr('donation page on the website') }}
        span .

  hr

  div.row
    div.col-md-6
      h4 {{ $tr('Resources') }}
      p
        ul
          li #[a(href="https://activitywatch.net/") {{ $tr('Website') }}]
          li #[a(href="https://activitywatch.readthedocs.org/") {{ $tr('Documentation') }}]
          li #[a(href="https://forum.activitywatch.net/") {{ $tr('Forum') }}]
          li #[a(href="https://discord.gg/vDskV9q") Discord]
          li #[a(href="https://github.com/ActivityWatch/activitywatch") GitHub]
          li #[a(href="/api/") {{ $tr('API Browser') }}]

    div.col-md-6
      h4 {{ $tr("Want to know what we're working on?") }}
      p
        | {{ $tr('Check out the ') }}
        a(href="https://forum.activitywatch.net/c/news") {{ $tr('development updates') }}
        span !

  hr

  p
    small
      i
        | {{ $tr('You can change which page opens when you open ActivityWatch (instead of this page) in the ') }}
        router-link(to="/settings") {{ $tr('settings') }}
        | {{ $tr(' page.') }}

</template>

<script lang="ts">
export default {
  name: 'Home',
};
</script>
